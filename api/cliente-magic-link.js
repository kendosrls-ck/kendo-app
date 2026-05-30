// /api/cliente-magic-link
// Genera un magic link per accedere all'area cliente senza password e lo invia via email.
// L'admin lo invia dal dettaglio cliente: il cliente riceve un link che, cliccato,
// lo logga automaticamente nell'app. Validità default: 1 ora.
//
// Input POST application/json: { cliente_id, email?, nome? }
// Output: { ok, sent }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "area-clienti@kendosrls.com";
const FROM_NAME = "Fit And Go Padova";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://app.kendosrls.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ ok: false, error: "Supabase env mancante" });
  if (!RESEND_KEY) return res.status(500).json({ ok: false, error: "Resend env mancante" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { cliente_id, email: emailIn, nome: nomeIn } = body;
    if (!cliente_id && !emailIn) return res.status(400).json({ ok: false, error: "cliente_id o email obbligatori" });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    let email = emailIn, nome = nomeIn;
    if (cliente_id) {
      const { data: c } = await sb.from("clienti").select("nome,cognome,email").eq("id", cliente_id).maybeSingle();
      if (!c) return res.status(404).json({ ok: false, error: "Cliente non trovato" });
      if (!c.email) return res.status(400).json({ ok: false, error: "Il cliente non ha un'email registrata" });
      email = c.email;
      nome = c.nome;
    }

    // Genera magic link via Supabase Admin API
    const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: String(email).trim().toLowerCase(),
      options: { redirectTo: `${BASE_URL}/area-cliente` },
    });
    if (linkErr) {
      console.error("magic link error:", linkErr);
      return res.status(500).json({ ok: false, error: linkErr.message });
    }

    const magicUrl = linkData?.properties?.action_link;
    if (!magicUrl) return res.status(500).json({ ok: false, error: "Impossibile generare link" });

    // Invia email
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [email],
        subject: "Il tuo accesso all'Area Cliente Fit And Go",
        html: htmlEmail({ nome, magicUrl }),
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error("Resend error:", r.status, txt);
      return res.status(502).json({ ok: false, error: "Email non inviata" });
    }

    return res.status(200).json({ ok: true, sent: true, email });
  } catch (e) {
    console.error("cliente-magic-link exception:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

function htmlEmail({ nome, magicUrl }) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#0a0a0a,#1e1b16);padding:28px;text-align:center">
      <div style="color:#D4A843;font-weight:700;font-size:22px;letterSpacing:2px">FIT AND GO</div>
      <div style="color:#cbd5e1;font-size:11px;margin-top:4px">Padova · La tua palestra digitale</div>
    </div>
    <div style="padding:32px 26px">
      <h2 style="color:#0a0a0a;margin:0 0 8px;font-size:22px">Ciao ${nome || ""}! 👋</h2>
      <p style="color:#475569;margin:0 0 24px;line-height:1.6">Da oggi hai un'<strong>Area Cliente personale</strong> dove puoi:</p>

      <ul style="color:#334155;line-height:1.9;padding-left:20px;margin:0 0 24px">
        <li>📅 <strong>Prenotare le sedute</strong> direttamente da telefono</li>
        <li>📊 Vedere le tue <strong>analisi BIA</strong> con storia e progressi</li>
        <li>💪 Sapere quante <strong>sedute hai ancora</strong> nel tuo pacchetto</li>
        <li>📞 Disdire o spostare un appuntamento senza chiamare</li>
      </ul>

      <a href="${magicUrl}" style="display:block;background:linear-gradient(135deg,#fbbf24,#D4A843,#b8860b);color:#0a0a0a;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:15px;box-shadow:0 4px 12px rgba(212,168,67,.4);margin:0 0 16px">
        ✨ Entra nell'Area Cliente
      </a>

      <div style="background:#fffbeb;border:1px solid #D4A84355;border-radius:10px;padding:14px;font-size:12px;color:#92400e;text-align:center;margin-top:18px">
        ⏱ Questo link è valido per <strong>1 ora</strong>. Se scade puoi sempre chiederne un altro al centro.
      </div>

      <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6">
        Non hai richiesto questa email? Ignorala, nessuno potrà accedere senza cliccare il link.<br/>
        Fit And Go Padova · Kendo SRLS · <a href="https://kendosrls.com" style="color:#D4A843;text-decoration:none">kendosrls.com</a>
      </div>
    </div>
  </div></body></html>`;
}
