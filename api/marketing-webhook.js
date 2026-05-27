// /api/marketing-webhook
// Riceve il contenuto CSV del file "Export analisi clienti" dallo script Gmail (Apps Script),
// parsa, filtra il negozio target e fa upsert dei clienti su Supabase.
// Rispetta lo status impostato manualmente (status_manuale=true non viene sovrascritto).
//
// Input: POST application/json
//   header: x-kendo-secret
//   body: { csv: "<contenuto csv>", negozio?: "FIT Padova" }
//
// Output: { ok, aggiornati, nuovi, errori, totale }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.LEAD_WEBHOOK_SECRET;
const NEGOZIO_DEFAULT = "FIT Padova";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-kendo-secret");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  if (!SECRET || req.headers["x-kendo-secret"] !== SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ ok: false, error: "Supabase env mancante" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const csv = body.csv;
    const negozioTarget = body.negozio || NEGOZIO_DEFAULT;
    if (!csv || typeof csv !== "string") {
      return res.status(400).json({ ok: false, error: "Campo csv mancante" });
    }

    const rows = parseCSV(csv);
    if (rows.length < 2) return res.status(400).json({ ok: false, error: "CSV vuoto o non valido" });

    const header = rows[0].map(h => cleanCell(h).toLowerCase());
    const idx = (sub) => header.findIndex(h => h.includes(sub));
    const cols = {
      negozio: idx("negozio"),
      nome: idx("nome"),
      cognome: header.findIndex(h => h.includes("surname") || h.includes("cognome")),
      email: idx("email"),
      sms: header.findIndex(h => h === "sms" || h.includes("sms") || h.includes("cellulare") || h.includes("telefono")),
      data_nascita: header.findIndex(h => h.includes("nascita")),
      status: idx("status"),
      sesso: idx("sesso"),
      cap: idx("cap"),
      valore: idx("valore"),
      debito: idx("debitoria"),
      fonte: idx("conosciuto"),
      cert_medico: header.findIndex(h => h.includes("certificato")),
      scad_iscrizione: header.findIndex(h => h.includes("scadenza iscriz")),
      ultimo_appt: header.findIndex(h => h.includes("ultimo appt")),
      ultima_bia: header.findIndex(h => h.includes("ultima bia")),
      creato_da: header.findIndex(h => h.includes("creato da")),
    };

    const data = rows.slice(1).filter(r => r.length >= 3).map(r => ({
      negozio: cleanCell(r[cols.negozio]),
      nome: cleanCell(r[cols.nome]),
      cognome: cleanCell(r[cols.cognome]),
      email: cleanCell(r[cols.email]).toLowerCase() || null,
      telefono: cleanCell(r[cols.sms]) || null,
      data_nascita: parseDate(cleanCell(r[cols.data_nascita])),
      status_crm: mapStatus(cleanCell(r[cols.status])),
      sesso: cleanCell(r[cols.sesso]) || null,
      cap: cleanCell(r[cols.cap]) || null,
      valore_cliente: parseNum(cleanCell(r[cols.valore])),
      posizione_debitoria: parseNum(cleanCell(r[cols.debito])),
      origine: cleanCell(r[cols.fonte]) || null,
      scadenza_certificato_medico: parseDate(cleanCell(r[cols.cert_medico])),
      scadenza_iscrizione: parseDate(cleanCell(r[cols.scad_iscrizione])),
      ultimo_appt_data: parseDate(cleanCell(r[cols.ultimo_appt])),
      ultima_bia_data: parseDate(cleanCell(r[cols.ultima_bia])),
      shoma_creato_da: cleanCell(r[cols.creato_da]) || null,
    })).filter(r => (r.nome || r.telefono || r.email) && (!negozioTarget || r.negozio === negozioTarget));

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: esistenti } = await sb.from("clienti").select("id, telefono, email, status_manuale");
    const byPhone = {}, byEmail = {};
    (esistenti || []).forEach(c => {
      const np = normPhone(c.telefono);
      if (np) byPhone[np] = c;
      if (c.email) byEmail[c.email.toLowerCase()] = c;
    });

    let aggiornati = 0, nuovi = 0, errori = 0;
    const now = new Date().toISOString();

    for (const r of data) {
      const np = normPhone(r.telefono);
      const match = (np && byPhone[np]) || (r.email && byEmail[r.email]);
      const base = {
        nome: r.nome || null, cognome: r.cognome || null,
        email: r.email, telefono: r.telefono, data_nascita: r.data_nascita,
        sesso: r.sesso, cap: r.cap,
        valore_cliente: r.valore_cliente, posizione_debitoria: r.posizione_debitoria,
        origine: r.origine,
        scadenza_certificato_medico: r.scadenza_certificato_medico,
        scadenza_iscrizione: r.scadenza_iscrizione,
        ultimo_appt_data: r.ultimo_appt_data, ultima_bia_data: r.ultima_bia_data,
        shoma_creato_da: r.shoma_creato_da, negozio: r.negozio,
        ultimo_import_at: now,
      };
      if (match) {
        const patch = { ...base };
        if (!match.status_manuale) patch.status_crm = r.status_crm;
        const { error } = await sb.from("clienti").update(patch).eq("id", match.id);
        if (error) errori++; else aggiornati++;
      } else {
        const { error } = await sb.from("clienti").insert({ ...base, status_crm: r.status_crm, status_manuale: false });
        if (error) errori++; else nuovi++;
      }
    }

    return res.status(200).json({ ok: true, aggiornati, nuovi, errori, totale: data.length });
  } catch (e) {
    console.error("marketing-webhook exception:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// ─── Helpers (stessa logica di src/ImportMarketing.js) ───
function parseCSV(text, sep = ";") {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === sep) { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function cleanCell(raw) {
  let v = (raw || "").trim();
  const m = v.match(/^=\s*"?(.*?)"?$/);
  if (m) v = m[1];
  return v.replace(/^"+|"+$/g, "").replace(/""/g, '"').trim();
}
function parseDate(s) {
  const m = (s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
function parseNum(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}
function normPhone(t) {
  let s = (t || "").replace(/[^0-9+]/g, "").replace(/^\+/, "");
  if (s.startsWith("0039")) s = s.slice(4);
  if (s.startsWith("39") && s.length >= 11) s = s.slice(2);
  if (s.startsWith("0")) s = s.slice(1);
  return s;
}
function mapStatus(s) {
  const v = (s || "").toUpperCase();
  if (v.includes("ATTIVO")) return "CLIENTE ATTIVO";
  if (v.includes("STAND")) return "CLIENTE STAND BY";
  if (v === "EX" || v.includes("EX ")) return "FINE PERCORSO";
  if (v.includes("ESCLUSO") || v.includes("CANCELL")) return "CANCELLATO";
  return "CLIENTE ATTIVO";
}
