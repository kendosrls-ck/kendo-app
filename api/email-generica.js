// /api/email-generica
// Endpoint generico per inviare un'email semplice (testo plain → HTML formattato).
// Usato per messaggi di reattivazione, comunicazioni interne, ecc.
//
// Input POST application/json: { to, subject, bodyText, fromName?, fromEmail? }
// Output: { ok }

const RESEND_KEY = process.env.RESEND_API_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!RESEND_KEY) return res.status(500).json({ ok: false, error: "Resend env mancante" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { to, subject, bodyText, fromName, fromEmail } = body;
    if (!to || !subject || !bodyText) return res.status(400).json({ ok: false, error: "to, subject, bodyText obbligatori" });

    const from = `${fromName || "Fit And Go Padova"} <${fromEmail || "info@kendosrls.com"}>`;
    const html = buildHtml(bodyText);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("Resend error:", r.status, txt);
      return res.status(502).json({ ok: false, error: "Email non inviata" });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("email-generica exception:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

function buildHtml(text) {
  // Converte i ritorni a capo in <br/> e crea email semplice ma branded
  const safe = String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#0a0a0a,#1e1b16);padding:22px;text-align:center">
      <div style="color:#D4A843;font-weight:700;font-size:20px;letter-spacing:2px">FIT AND GO</div>
      <div style="color:#cbd5e1;font-size:11px;margin-top:4px">Padova</div>
    </div>
    <div style="padding:30px 26px;color:#334155;font-size:14px;line-height:1.7">${safe}</div>
    <div style="padding:14px 26px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;background:#fafafa">
      Fit And Go Padova · Kendo SRLS · <a href="https://kendosrls.com" style="color:#D4A843;text-decoration:none">kendosrls.com</a>
    </div>
  </div></body></html>`;
}
