// /api/cron-reminders
// Cron job giornaliero (Vercel Cron) che invia automaticamente:
// 1. Auguri di compleanno (se compleanno = oggi)
// 2. Avviso certificato medico in scadenza (esattamente 30, 14, 7, 1 giorni prima)
// 3. Avviso sedute residue basse (≤3 sedute, max 1 invio ogni 14 giorni)
// 4. Avviso rinnovo iscrizione/abbonamento (30 giorni prima)
//
// Sicurezza: protetto da header `x-cron-secret` (env CRON_SECRET) — Vercel Cron lo aggiunge automaticamente.
// Output: { ok, sent: { compleanno, certificato, sedute, rinnovo }, errori }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "info@kendosrls.com";
const FROM_NAME = "Fit And Go Padova";
const ADMIN_EMAIL = "kendosrls@gmail.com";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://app.kendosrls.com";

export default async function handler(req, res) {
  // Sicurezza: accetta solo Vercel Cron oppure POST manuale con secret
  const isVercelCron = req.headers["user-agent"]?.startsWith("vercel-cron") ||
                       req.headers["x-vercel-cron"] !== undefined;
  const secretOk = req.headers["x-cron-secret"] === process.env.CRON_SECRET;
  if (!isVercelCron && !secretOk) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  if (!SUPABASE_URL || !SERVICE_KEY || !RESEND_KEY) {
    return res.status(500).json({ ok: false, error: "Env mancanti" });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const oggi = new Date();
  const oggiIso = oggi.toISOString().split("T")[0];
  const annoCorrente = oggi.getFullYear();
  const meseOggi = oggi.getMonth();
  const giornoOggi = oggi.getDate();

  const stats = { compleanno: 0, certificato: 0, sedute: 0, rinnovo: 0, errori: 0 };
  const errori = [];

  try {
    // Carica tutti i clienti attivi con email
    const { data: clienti } = await sb
      .from("clienti")
      .select("id, nome, cognome, email, telefono, pacchetto, data_nascita, scadenza_certificato_medico, scadenza_iscrizione, sedute_total, sedute_usate, status_crm, reminder_certificato_inviato_at, reminder_compleanno_anno, reminder_rinnovo_inviato_at, reminder_sedute_basse_inviato_at")
      .or("status_crm.eq.CLIENTE ATTIVO,status_crm.is.null")
      .not("email", "is", null);

    for (const c of clienti || []) {
      const nome = c.nome || "";
      const email = c.email;

      // 1. COMPLEANNO
      if (c.data_nascita) {
        const dn = new Date(c.data_nascita);
        if (dn.getMonth() === meseOggi && dn.getDate() === giornoOggi && c.reminder_compleanno_anno !== annoCorrente) {
          const eta = annoCorrente - dn.getFullYear();
          const ok = await sendEmail({ to: email, subject: `🎂 Buon compleanno ${nome}!`, html: tplCompleanno({ nome, eta }) });
          if (ok) {
            await sb.from("clienti").update({ reminder_compleanno_anno: annoCorrente }).eq("id", c.id);
            await sb.from("reminder_log").insert({ cliente_id: c.id, tipo: "compleanno", destinatario: email });
            stats.compleanno++;
          } else {
            await sb.from("reminder_log").insert({ cliente_id: c.id, tipo: "compleanno", destinatario: email, esito: "errore" });
            stats.errori++;
          }
        }
      }

      // 2. CERTIFICATO MEDICO in scadenza (30 / 14 / 7 / 1 giorni)
      if (c.scadenza_certificato_medico) {
        const scad = new Date(c.scadenza_certificato_medico);
        const giorni = Math.floor((scad - oggi) / 86400000);
        const ultimoInvio = c.reminder_certificato_inviato_at ? new Date(c.reminder_certificato_inviato_at) : null;
        const giorniDaUltimo = ultimoInvio ? Math.floor((oggi - ultimoInvio) / 86400000) : 999;

        // Invia se siamo esattamente a 30, 14, 7 o 1 giorno dalla scadenza, e non già inviato negli ultimi 5 giorni
        const giorniAttivi = [30, 14, 7, 1];
        if (giorniAttivi.includes(giorni) && giorniDaUltimo >= 5) {
          const ok = await sendEmail({ to: email, subject: `⚕ Certificato medico in scadenza tra ${giorni} ${giorni === 1 ? "giorno" : "giorni"}`, html: tplCertificato({ nome, giorni, scadenza: scad.toLocaleDateString("it-IT") }) });
          if (ok) {
            await sb.from("clienti").update({ reminder_certificato_inviato_at: new Date().toISOString() }).eq("id", c.id);
            await sb.from("reminder_log").insert({ cliente_id: c.id, tipo: "certificato", destinatario: email });
            stats.certificato++;
          } else {
            stats.errori++;
          }
        }
      }

      // 3. SEDUTE in esaurimento (≤3 residue, max 1 invio ogni 14 giorni)
      const seduteRes = (c.sedute_total || 0) - (c.sedute_usate || 0);
      if (seduteRes > 0 && seduteRes <= 3 && c.sedute_total > 0) {
        const ultimoInvio = c.reminder_sedute_basse_inviato_at ? new Date(c.reminder_sedute_basse_inviato_at) : null;
        const giorniDaUltimo = ultimoInvio ? Math.floor((oggi - ultimoInvio) / 86400000) : 999;
        if (giorniDaUltimo >= 14) {
          const ok = await sendEmail({ to: email, subject: `Solo ${seduteRes} ${seduteRes === 1 ? "seduta" : "sedute"} ${seduteRes === 1 ? "rimasta" : "rimaste"} nel tuo pacchetto`, html: tplSeduteBasse({ nome, residue: seduteRes, pacchetto: c.pacchetto || "il tuo pacchetto" }) });
          if (ok) {
            await sb.from("clienti").update({ reminder_sedute_basse_inviato_at: new Date().toISOString() }).eq("id", c.id);
            await sb.from("reminder_log").insert({ cliente_id: c.id, tipo: "sedute_basse", destinatario: email });
            stats.sedute++;
          } else {
            stats.errori++;
          }
        }
      }

      // 4. RINNOVO ISCRIZIONE (30 giorni prima)
      if (c.scadenza_iscrizione) {
        const scad = new Date(c.scadenza_iscrizione);
        const giorni = Math.floor((scad - oggi) / 86400000);
        const ultimoInvio = c.reminder_rinnovo_inviato_at ? new Date(c.reminder_rinnovo_inviato_at) : null;
        const giorniDaUltimo = ultimoInvio ? Math.floor((oggi - ultimoInvio) / 86400000) : 999;
        if (giorni === 30 && giorniDaUltimo >= 60) {
          const ok = await sendEmail({ to: email, subject: `📅 Il tuo abbonamento Fit And Go scade tra 30 giorni`, html: tplRinnovo({ nome, scadenza: scad.toLocaleDateString("it-IT") }) });
          if (ok) {
            await sb.from("clienti").update({ reminder_rinnovo_inviato_at: new Date().toISOString() }).eq("id", c.id);
            await sb.from("reminder_log").insert({ cliente_id: c.id, tipo: "rinnovo", destinatario: email });
            stats.rinnovo++;
          } else {
            stats.errori++;
          }
        }
      }
    }

    // Notifica admin con riepilogo (solo se almeno 1 invio o errore)
    const totale = stats.compleanno + stats.certificato + stats.sedute + stats.rinnovo;
    if (totale > 0 || stats.errori > 0) {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[Kendo] Riepilogo reminder ${oggiIso}: ${totale} invii`,
        html: tplAdminRiepilogo({ stats, data: oggiIso }),
      });
    }

    return res.status(200).json({ ok: true, data: oggiIso, sent: stats });
  } catch (e) {
    console.error("cron-reminders exception:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// ===== EMAIL HELPER =====
async function sendEmail({ to, subject, html }) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }),
    });
    return r.ok;
  } catch (e) {
    console.error("sendEmail error:", e);
    return false;
  }
}

// ===== TEMPLATES EMAIL =====

function wrap(content, accent = "#D4A843") {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#0a0a0a,#1e1b16);padding:24px;text-align:center">
      <div style="color:${accent};font-weight:700;font-size:22px;letter-spacing:2px">FIT AND GO</div>
      <div style="color:#cbd5e1;font-size:11px;margin-top:4px">Padova</div>
    </div>
    <div style="padding:32px 26px">${content}</div>
    <div style="padding:14px 26px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;background:#fafafa">
      Fit And Go Padova · Kendo SRLS · <a href="https://kendosrls.com" style="color:#D4A843;text-decoration:none">kendosrls.com</a>
    </div>
  </div></body></html>`;
}

function tplCompleanno({ nome, eta }) {
  return wrap(`
    <div style="text-align:center;font-size:60px;line-height:1;margin-bottom:16px">🎂</div>
    <h2 style="color:#0a0a0a;margin:0 0 12px;font-size:24px;text-align:center">Buon compleanno ${nome}!</h2>
    <p style="color:#475569;line-height:1.6;text-align:center;font-size:15px">
      Tutto il team di <strong>Fit And Go Padova</strong> ti augura il più sincero buon compleanno!<br/>
      Che sia un anno pieno di energia, salute e nuovi traguardi 💪
    </p>
    <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #D4A84355;border-radius:12px;padding:18px;margin:24px 0;text-align:center">
      <div style="font-size:13px;color:#92400e;font-weight:600">🎁 Regalo per te:</div>
      <div style="font-size:16px;color:#0a0a0a;font-weight:700;margin-top:6px">Una seduta in regalo!</div>
      <div style="font-size:12px;color:#92400e;margin-top:4px">Vieni in centro entro fine mese per scoprire come riscuoterla</div>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">Con affetto,<br/>il team Fit And Go Padova</p>
  `, "#D4A843");
}

function tplCertificato({ nome, giorni, scadenza }) {
  const urgenza = giorni <= 1 ? "URGENTE" : giorni <= 7 ? "importante" : "promemoria";
  return wrap(`
    <h2 style="color:#0a0a0a;margin:0 0 8px;font-size:20px">Ciao ${nome},</h2>
    <p style="color:#475569;line-height:1.6;font-size:14px">
      Ti ricordiamo che il tuo <strong>certificato medico</strong> per l'attività sportiva non agonistica scade ${giorni === 1 ? "DOMANI" : `tra ${giorni} giorni`} (il <strong>${scadenza}</strong>).
    </p>
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:16px;margin:20px 0">
      <div style="color:${giorni <= 7 ? "#dc2626" : "#f59e0b"};font-weight:600;font-size:13px;margin-bottom:6px">
        ⚠ ${urgenza.toUpperCase()}
      </div>
      <div style="color:#7f1d1d;font-size:13px;line-height:1.6">
        Senza un certificato in corso di validità <strong>non potrai allenarti</strong>. Per legge dobbiamo verificarlo ad ogni rinnovo annuale.
      </div>
    </div>
    <p style="color:#475569;line-height:1.6;font-size:14px">
      Per rinnovarlo basta una visita dal tuo medico di base o presso un centro di medicina sportiva. Quando l'hai pronto, portacelo in centro o invialo via email.
    </p>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Grazie!<br/>Fit And Go Padova</p>
  `, "#f59e0b");
}

function tplSeduteBasse({ nome, residue, pacchetto }) {
  return wrap(`
    <h2 style="color:#0a0a0a;margin:0 0 8px;font-size:20px">Ciao ${nome},</h2>
    <p style="color:#475569;line-height:1.6;font-size:14px">
      Ti restano solo <strong style="color:#D4A843;font-size:18px">${residue}</strong> ${residue === 1 ? "seduta" : "sedute"} nel tuo pacchetto <strong>${pacchetto}</strong>.
    </p>
    <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #D4A84355;border-radius:12px;padding:18px;margin:20px 0;text-align:center">
      <div style="font-size:13px;color:#92400e;font-weight:600">È il momento di pensare al rinnovo!</div>
      <div style="font-size:12px;color:#92400e;margin-top:6px">Vieni in centro o chiamaci per scegliere il pacchetto giusto per i tuoi obiettivi.</div>
    </div>
    <a href="${BASE_URL}" style="display:block;background:linear-gradient(135deg,#fbbf24,#D4A843,#b8860b);color:#0a0a0a;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:700;font-size:14px;margin:18px 0">
      Vai alla tua area cliente
    </a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">A presto in centro!<br/>Fit And Go Padova</p>
  `, "#D4A843");
}

function tplRinnovo({ nome, scadenza }) {
  return wrap(`
    <h2 style="color:#0a0a0a;margin:0 0 8px;font-size:20px">Ciao ${nome},</h2>
    <p style="color:#475569;line-height:1.6;font-size:14px">
      Il tuo abbonamento annuale Fit And Go scade tra <strong>30 giorni</strong>, il <strong>${scadenza}</strong>.
    </p>
    <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #10b98155;border-radius:12px;padding:18px;margin:20px 0">
      <div style="color:#065f46;font-weight:600;font-size:14px;margin-bottom:6px">🎯 Continuiamo insieme!</div>
      <div style="color:#065f46;font-size:13px;line-height:1.6">
        Rinnova adesso per non interrompere il tuo percorso. Passa in centro o contattaci per scegliere il pacchetto migliore per il prossimo anno.
      </div>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Ti aspettiamo!<br/>Fit And Go Padova</p>
  `, "#10b981");
}

function tplAdminRiepilogo({ stats, data }) {
  return wrap(`
    <h2 style="color:#0a0a0a;margin:0 0 12px;font-size:18px">Reminder del ${data}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">
      <tr><td style="padding:8px 0;color:#64748b">🎂 Compleanni</td><td style="text-align:right;font-weight:600;color:#0a0a0a">${stats.compleanno}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">⚕ Certificati</td><td style="text-align:right;font-weight:600;color:#0a0a0a">${stats.certificato}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">📦 Sedute basse</td><td style="text-align:right;font-weight:600;color:#0a0a0a">${stats.sedute}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">📅 Rinnovi</td><td style="text-align:right;font-weight:600;color:#0a0a0a">${stats.rinnovo}</td></tr>
      ${stats.errori > 0 ? `<tr><td style="padding:8px 0;color:#dc2626">⚠ Errori</td><td style="text-align:right;font-weight:600;color:#dc2626">${stats.errori}</td></tr>` : ""}
    </table>
    <p style="color:#94a3b8;font-size:11px;margin-top:20px">Sistema Kendo · Reminder automatico</p>
  `);
}
