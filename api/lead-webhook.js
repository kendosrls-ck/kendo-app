// /api/lead-webhook
// Riceve POST dal Google Apps Script che legge fitandgopadova@gmail.com.
// Inserisce il lead nella tabella `leads` di Supabase.
//
// Sicurezza:
//   - shared secret nell'header `x-kendo-secret` (env LEAD_WEBHOOK_SECRET)
//   - usa la SUPABASE_SERVICE_ROLE_KEY (server-side, NON esposta al client)
//   - dedupe via leads.email_id UNIQUE (gmail message id)

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // CORS minimale (al webhook ci arriva solo Apps Script che non rispetta CORS, ma utile in test)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-kendo-secret");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verifica shared secret
  const expected = process.env.LEAD_WEBHOOK_SECRET;
  const got = req.headers["x-kendo-secret"];
  if (!expected || got !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Verifica env Supabase
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { nome, cognome, email, telefono, fonte, campagna, messaggio, email_subject, email_received_at, email_id } = body;

    // Validazione minima
    if (!nome || String(nome).trim().length === 0) {
      return res.status(400).json({ error: "Missing nome" });
    }

    // Normalizza telefono → solo cifre
    const tel = telefono ? String(telefono).trim() : null;
    const telNorm = tel ? tel.replace(/[^0-9]/g, "") : null;

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const payload = {
      nome: String(nome).trim(),
      cognome: cognome ? String(cognome).trim() : null,
      email: email ? String(email).trim() : null,
      cellulare: tel,
      telefono_normalizzato: telNorm,
      fonte: fonte || "Gmail",
      campagna: campagna || null,
      messaggio: messaggio || null,
      email_subject: email_subject || null,
      email_received_at: email_received_at || new Date().toISOString(),
      email_id: email_id || null,
      stato: "nuovo",
    };

    // Insert con onConflict su email_id per evitare duplicati
    let q = sb.from("leads").insert(payload).select().single();
    if (email_id) {
      q = sb.from("leads").upsert(payload, { onConflict: "email_id", ignoreDuplicates: true }).select().single();
    }

    const { data, error } = await q;
    if (error) {
      // Se errore di duplicato → 200 con info (Apps Script non riprocessa)
      if (error.code === "23505") {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      console.error("[lead-webhook] supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, id: data?.id });
  } catch (err) {
    console.error("[lead-webhook] exception:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
