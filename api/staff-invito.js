// /api/staff-invito
// Invita un membro dello staff (admin/trainer/reception) via magic link.
// Crea o aggiorna il profilo con il ruolo richiesto.
//
// Input POST: { email, nome, ruolo: 'admin'|'trainer'|'reception' }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "info@kendosrls.com";
const FROM_NAME = "Fit And Go Padova";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://app.kendosrls.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { email, nome, ruolo, invitato_da } = body;
    if (!email || !ruolo) return res.status(400).json({ ok: false, error: "email e ruolo obbligatori" });
    if (!["admin", "trainer", "reception"].includes(ruolo)) return res.status(400).json({ ok: false, error: "Ruolo non valido" });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const emailNorm = String(email).trim().toLowerCase();

    // Genera magic link
    const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: emailNorm,
      options: { redirectTo: `${BASE_URL}` },
    });
    if (linkErr) return res.status(500).json({ ok: false, error: linkErr.message });
    const userId = linkData?.user?.id;
    const magicUrl = linkData?.properties?.action_link;
    if (!userId || !magicUrl) return res.status(500).json({ ok: false, error: "Generazione link fallita" });

    // Crea/aggiorna profilo con ruolo + flag is_admin
    const profilePayload = {
      id: userId,
      nome: nome || emailNorm.split("@")[0],
      ruolo,
      is_admin: ruolo === "admin",
      attivo: true,
      invitato_da: invitato_da || null,
      invitato_at: new Date().toISOString(),
    };
    await sb.from("profiles").upsert(profilePayload, { onConflict: "id" });

    // Email di invito
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [emailNorm],
        subject: `Sei stato invitato come ${labRuolo(ruolo)} - Fit And Go`,
        html: htmlInvito({ nome: nome || "", ruolo, magicUrl }),
      }),
    });

    return res.status(200).json({ ok: true, userId });
  } catch (e) {
    console.error("staff-invito exception:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

function labRuolo(r) {
  return { admin: "Amministratore", trainer: "Trainer", reception: "Receptionist" }[r] || r;
}

function htmlInvito({ nome, ruolo, magicUrl }) {
  const ruoloLab = labRuolo(ruolo);
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#0a0a0a,#1e1b16);padding:28px;text-align:center">
      <div style="color:#D4A843;font-weight:700;font-size:22px;letter-spacing:2px">FIT AND GO</div>
      <div style="color:#cbd5e1;font-size:11px;margin-top:4px">Sistema gestionale Kendo</div>
    </div>
    <div style="padding:32px 26px">
      <h2 style="color:#0a0a0a;margin:0 0 8px;font-size:22px">Benvenuto${nome ? " " + nome : ""}! 👋</h2>
      <p style="color:#475569;margin:0 0 20px;line-height:1.6">
        Sei stato invitato come <strong style="color:#D4A843">${ruoloLab}</strong> nel sistema gestionale di Fit And Go Padova.
      </p>
      <p style="color:#475569;margin:0 0 24px;line-height:1.6">
        Clicca il pulsante qui sotto per accedere e iniziare. Non serve nessuna password: il link ti loggherà automaticamente.
      </p>
      <a href="${magicUrl}" style="display:block;background:linear-gradient(135deg,#fbbf24,#D4A843,#b8860b);color:#0a0a0a;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:15px;box-shadow:0 4px 12px rgba(212,168,67,.4)">
        ✨ Accedi al gestionale
      </a>
      <div style="background:#fffbeb;border:1px solid #D4A84355;border-radius:10px;padding:14px;font-size:12px;color:#92400e;text-align:center;margin-top:18px">
        ⏱ Questo link è valido per <strong>1 ora</strong>.
      </div>
    </div>
  </div></body></html>`;
}
