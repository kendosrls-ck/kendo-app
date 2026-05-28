// /api/prenotazione-conferma
// Invia email di conferma prenotazione al cliente con allegato .ics
// (compatibile Google Calendar, Apple Calendar, Outlook).
//
// Input: { appuntamento_id }
// Output: { ok, sent }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "prenotazioni@kendosrls.com";
const FROM_NAME = "Fit And Go Padova";
const ADMIN_EMAIL = "kendosrls@gmail.com";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://app.kendosrls.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ ok: false, error: "Supabase env mancante" });
  if (!RESEND_KEY) return res.status(500).json({ ok: false, error: "Resend env mancante" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { appuntamento_id } = body;
    if (!appuntamento_id) return res.status(400).json({ ok: false, error: "appuntamento_id obbligatorio" });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Carica appuntamento + risorsa
    const { data: a, error: e1 } = await sb
      .from("appuntamento")
      .select("*, risorsa:risorsa_id(nome, tipo)")
      .eq("id", appuntamento_id)
      .maybeSingle();
    if (e1 || !a) return res.status(404).json({ ok: false, error: "Appuntamento non trovato" });

    const risorsaNome = a.risorsa?.nome || a.tipo_seduta || "Sessione";
    const dataIso = a.data; // YYYY-MM-DD
    const dataItalian = new Date(dataIso + "T00:00:00").toLocaleDateString("it-IT", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const oraInizio = (a.ora_inizio || "").slice(0, 5);
    const oraFine = (a.ora_fine || "").slice(0, 5);
    const cliNome = `${a.cliente_nome || ""} ${a.cliente_cognome || ""}`.trim() || "Cliente";

    // Genera file .ics
    const ics = generaIcs({
      uid: a.id,
      summary: `${risorsaNome} - Fit And Go`,
      description: `Sessione ${a.tipo_seduta || risorsaNome} prenotata presso Fit And Go Padova. Per disdire: ${BASE_URL}/disdici/${a.token_pubblico}`,
      location: "Fit And Go Padova",
      data: dataIso,
      oraInizio,
      oraFine,
    });
    const icsBase64 = Buffer.from(ics, "utf-8").toString("base64");

    // Email cliente
    if (a.cliente_email) {
      await sendEmail({
        to: a.cliente_email,
        subject: `✓ Prenotazione confermata - ${dataItalian} ${oraInizio}`,
        html: htmlCliente({ cliNome, risorsaNome, dataItalian, oraInizio, oraFine, token: a.token_pubblico }),
        attachments: [{ filename: "appuntamento.ics", content: icsBase64, content_type: "text/calendar" }],
      });
    }

    // Email admin (riepilogo)
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Nuova prenotazione: ${cliNome} - ${dataItalian} ${oraInizio}`,
      html: htmlAdmin({ cliNome, risorsaNome, dataItalian, oraInizio, oraFine, telefono: a.cliente_telefono, note: a.note }),
    });

    // Marca come notificato
    await sb.from("appuntamento").update({ notifica_inviata_at: new Date().toISOString() }).eq("id", appuntamento_id);

    return res.status(200).json({ ok: true, sent: !!a.cliente_email });
  } catch (e) {
    console.error("prenotazione-conferma exception:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// ===== HELPERS =====

async function sendEmail({ to, subject, html, attachments }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
      ...(attachments?.length ? { attachments } : {}),
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    console.error("Resend error:", r.status, txt);
  }
}

// Genera file iCalendar (.ics) standard
function generaIcs({ uid, summary, description, location, data, oraInizio, oraFine }) {
  const toIcsDate = (d, hm) => {
    // formato locale (TZ Europe/Rome) → 20260601T160000
    const dt = d.replace(/-/g, "");
    const tm = (hm || "00:00").replace(":", "") + "00";
    return `${dt}T${tm}`;
  };
  const dtStart = toIcsDate(data, oraInizio);
  const dtEnd = toIcsDate(data, oraFine);
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const escape = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kendo SRLS//Fit And Go Padova//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Rome",
    "BEGIN:STANDARD",
    "DTSTART:19701025T030000",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700329T020000",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}@kendosrls.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Europe/Rome:${dtStart}`,
    `DTEND;TZID=Europe/Rome:${dtEnd}`,
    `SUMMARY:${escape(summary)}`,
    `DESCRIPTION:${escape(description)}`,
    `LOCATION:${escape(location)}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Promemoria sessione Fit And Go",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function htmlCliente({ cliNome, risorsaNome, dataItalian, oraInizio, oraFine, token }) {
  const disdiciUrl = `${BASE_URL}/disdici/${token}`;
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#0a0a0a,#1e1b16);padding:24px;text-align:center">
      <div style="color:#D4A843;font-weight:700;font-size:20px">FIT AND GO</div>
      <div style="color:#cbd5e1;font-size:12px;margin-top:4px">Padova</div>
    </div>
    <div style="padding:28px 24px">
      <h2 style="color:#0a0a0a;margin:0 0 6px;font-size:20px">Ciao ${cliNome}!</h2>
      <p style="color:#475569;margin:0 0 20px">La tua prenotazione è confermata ✓</p>

      <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #D4A84355;border-radius:12px;padding:20px;margin:0 0 20px">
        <div style="font-size:11px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:1px">Sessione</div>
        <div style="font-size:22px;font-weight:700;color:#0a0a0a;margin:4px 0 12px">${risorsaNome}</div>
        <div style="color:#475569;font-size:14px;line-height:1.8">
          <strong>📅 ${dataItalian}</strong><br/>
          <strong>🕐 ${oraInizio} - ${oraFine}</strong><br/>
          📍 Fit And Go Padova
        </div>
      </div>

      <div style="background:#ecfdf5;border:1px solid #10b98133;border-radius:10px;padding:14px;margin:0 0 20px">
        <div style="font-weight:600;color:#059669;font-size:13px;margin-bottom:4px">📲 Aggiungi al tuo calendario</div>
        <div style="font-size:12px;color:#334155">Apri l'allegato <strong>appuntamento.ics</strong> di questa email e l'appuntamento si aggiungerà automaticamente a Google Calendar, Apple Calendar o Outlook.</div>
      </div>

      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px;margin:0 0 20px;font-size:12px;color:#7f1d1d">
        ⚠ <strong>Ricorda:</strong> Le sedute vanno disdette almeno <strong>24 ore prima</strong>, altrimenti vengono comunque scalate dal pacchetto.
      </div>

      <a href="${disdiciUrl}" style="display:block;text-align:center;padding:12px;background:white;border:1px solid #e2e8f0;border-radius:10px;color:#dc2626;text-decoration:none;font-weight:600;font-size:13px">Disdici questa prenotazione</a>

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">
        Fit And Go Padova · Kendo SRLS · prenotazioni@kendosrls.com
      </div>
    </div>
  </div></body></html>`;
}

function htmlAdmin({ cliNome, risorsaNome, dataItalian, oraInizio, oraFine, telefono, note }) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <h2 style="color:#0a0a0a;margin:0 0 16px;font-size:18px">Nuova prenotazione</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#64748b">Cliente</td><td style="font-weight:600">${cliNome}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Telefono</td><td>${telefono || "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Risorsa</td><td>${risorsaNome}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Quando</td><td>${dataItalian}<br/>${oraInizio} - ${oraFine}</td></tr>
      ${note ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top">Note</td><td>${note}</td></tr>` : ""}
    </table>
  </div></body></html>`;
}
