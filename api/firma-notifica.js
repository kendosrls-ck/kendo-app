// /api/firma-notifica
// Invia un'email all'admin quando un cliente completa il flusso firma K-Sign.
// Per ora: solo email di notifica con dettagli + link al pannello (no PDF allegato — Fase 2).
//
// Input: POST application/json
//   { richiesta_id: "uuid", token: "string-pubblico" }
//
// Output:
//   { ok: true, email_id: "..." } | { ok: false, error: "..." }
//
// Richiede env: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// L'admin che riceve è kendosrls@gmail.com (account Resend free permette solo email a se stessi).

import { createClient } from "@supabase/supabase-js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Destinatari email
const ADMIN_EMAIL = "kendosrls@gmail.com";
// Mittente professionale dal dominio verificato kendosrls.com
const FROM_EMAIL = "firme@kendosrls.com";
const FROM_NAME = "Kendo Firme";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  if (!RESEND_API_KEY) return res.status(500).json({ ok: false, error: "RESEND_API_KEY non configurato" });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ ok: false, error: "Supabase env mancante" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { richiesta_id, token } = body;

    if (!richiesta_id && !token) {
      return res.status(400).json({ ok: false, error: "richiesta_id o token obbligatorio" });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1. Recupera la richiesta
    const q = sb.from("ksign_richiesta").select("*");
    const { data: richiesta, error: errReq } = richiesta_id
      ? await q.eq("id", richiesta_id).maybeSingle()
      : await q.eq("token_pubblico", token).maybeSingle();
    if (errReq || !richiesta) return res.status(404).json({ ok: false, error: "Richiesta non trovata" });

    // 2. Recupera le firme + consensi associati
    const [{ data: firme }, { data: consensi }] = await Promise.all([
      sb.from("ksign_firma").select("etichetta, firmato_at").eq("richiesta_id", richiesta.id),
      sb.from("ksign_consenso").select("etichetta, valore").eq("richiesta_id", richiesta.id),
    ]);

    // 3. Compose email HTML
    const nomeCliente = `${richiesta.firmatario_nome || ""} ${richiesta.firmatario_cognome || ""}`.trim();
    const tipoDoc = (richiesta.template_codici || []).join(" + ");
    const dataFirma = new Date(richiesta.signed_at || Date.now()).toLocaleString("it-IT", {
      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const idTransazione = `KS-${String(richiesta.numero_progressivo || 0).padStart(6, "0")}`;
    const linkPannello = `https://kendo-app-weld.vercel.app/`; // sezione Firme

    const firmeList = (firme || []).map(f => `<li>${escapeHtml(f.etichetta)}</li>`).join("");
    const consensiList = (consensi || []).map(c => `<li>${escapeHtml(c.etichetta)}: <strong style="color:${c.valore === "si" ? "#2a9d6f" : "#c0392b"}">${c.valore.toUpperCase()}</strong></li>`).join("");

    const html = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><title>Firma completata</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:#D4A843;color:#080808;padding:8px 16px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:2px;">KENDO</div>
      </div>

      <h1 style="font-size:22px;color:#080808;margin:0 0 8px;text-align:center;">✓ Firma completata</h1>
      <p style="text-align:center;color:#666;margin:0 0 24px;font-size:14px;">Un cliente ha appena firmato i documenti.</p>

      <div style="background:#fafaf7;border:1px solid #e5e5e0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Dettagli</div>
        <div style="font-size:15px;color:#080808;font-weight:600;margin-bottom:4px;">${escapeHtml(nomeCliente)}</div>
        <div style="font-size:13px;color:#666;line-height:1.6;">
          📧 ${escapeHtml(richiesta.firmatario_email || "—")}<br>
          📱 ${escapeHtml(richiesta.firmatario_telefono || "—")}<br>
          📄 Documenti: <strong>${escapeHtml(tipoDoc)}</strong><br>
          🕐 Firmato il: <strong>${dataFirma}</strong><br>
          🔖 ID transazione: <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:12px;">${idTransazione}</code>
        </div>
      </div>

      ${firmeList ? `
      <div style="background:#fafaf7;border:1px solid #e5e5e0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Firme apposte (${(firme || []).length})</div>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#080808;line-height:1.7;">${firmeList}</ul>
      </div>` : ""}

      ${consensiList ? `
      <div style="background:#fafaf7;border:1px solid #e5e5e0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Consensi GDPR</div>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#080808;line-height:1.7;">${consensiList}</ul>
      </div>` : ""}

      <a href="${linkPannello}" style="display:block;text-align:center;background:#D4A843;color:#080808;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-top:24px;">Apri il pannello Kendo</a>

      <div style="text-align:center;color:#999;font-size:11px;margin-top:24px;line-height:1.5;">
        Email automatica generata da K-Sign · Kendo Fit & Go Padova<br>
        Tutte le firme sono conservate nel sistema con audit log immutabile (eIDAS).
      </div>
    </div>
  </div>
</body>
</html>`;

    // 4a. Invia email all'ADMIN (con tutti i dettagli)
    const sendEmail = async (to, subject, htmlBody) => {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: Array.isArray(to) ? to : [to],
          subject,
          html: htmlBody,
        }),
      });
      const data = await r.json();
      return { ok: r.ok, status: r.status, data };
    };

    const adminRes = await sendEmail(ADMIN_EMAIL, `✓ Firma completata: ${nomeCliente}`, html);
    if (!adminRes.ok) {
      console.error("Resend admin error:", adminRes.status, adminRes.data);
      return res.status(502).json({ ok: false, error: adminRes.data?.message || "Errore invio email admin", status: adminRes.status });
    }

    // 4b. Invia email al CLIENTE (versione semplificata di conferma) — solo se ha email valida
    let emailClienteId = null;
    if (richiesta.firmatario_email) {
      const htmlCliente = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><title>Firma completata</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:#D4A843;color:#080808;padding:8px 16px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:2px;">KENDO</div>
      </div>
      <h1 style="font-size:22px;color:#080808;margin:0 0 16px;text-align:center;">Grazie ${escapeHtml(richiesta.firmatario_nome || "")}! ✓</h1>
      <p style="font-size:15px;color:#333;line-height:1.6;text-align:center;margin-bottom:24px;">
        La tua firma è stata registrata correttamente. Documento: <strong>${escapeHtml(tipoDoc)}</strong>.
      </p>
      <div style="background:#fafaf7;border:1px solid #e5e5e0;border-radius:8px;padding:16px;margin-bottom:24px;">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Riepilogo</div>
        <div style="font-size:13px;color:#333;line-height:1.8;">
          🕐 Data firma: <strong>${dataFirma}</strong><br>
          🔖 ID transazione: <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:12px;">${idTransazione}</code><br>
          ✍️ Firme apposte: <strong>${(firme || []).length}</strong>
        </div>
      </div>
      <p style="font-size:13px;color:#666;line-height:1.6;text-align:center;margin-bottom:8px;">
        Conserviamo i tuoi documenti firmati nel nostro sistema con audit log immutabile per garantirne la validità legale (eIDAS).
      </p>
      <p style="font-size:13px;color:#666;line-height:1.6;text-align:center;">
        Per qualsiasi chiarimento, scrivici a <a href="mailto:${ADMIN_EMAIL}" style="color:#D4A843;">${ADMIN_EMAIL}</a>.
      </p>
      <div style="text-align:center;color:#999;font-size:11px;margin-top:24px;line-height:1.5;border-top:1px solid #e5e5e0;padding-top:16px;">
        Fit And Go Padova · Kendo SRLS<br>
        Ti aspettiamo in centro 💪⚡
      </div>
    </div>
  </div>
</body>
</html>`;
      const clientRes = await sendEmail(richiesta.firmatario_email, `Firma completata - Fit And Go Padova`, htmlCliente);
      if (clientRes.ok) {
        emailClienteId = clientRes.data?.id;
      } else {
        console.warn("Resend cliente error (non-blocking):", clientRes.status, clientRes.data);
      }
    }

    // 5. Audit log dell'invio email
    const recipients = [ADMIN_EMAIL];
    if (emailClienteId) recipients.push(richiesta.firmatario_email);
    await sb.from("ksign_audit_log").insert({
      richiesta_id: richiesta.id,
      evento: "email_notifica_inviata",
      descrizione: `Email notifica inviata a ${recipients.join(", ")}`,
      attore_tipo: "sistema",
    }).catch(() => {});

    return res.status(200).json({
      ok: true,
      email_admin_id: adminRes.data?.id,
      email_cliente_id: emailClienteId,
      to: recipients,
    });
  } catch (e) {
    console.error("firma-notifica exception:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
