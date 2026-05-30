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

    const emailNorm = email ? String(email).trim().toLowerCase() : null;

    const payload = {
      nome: String(nome).trim(),
      cognome: cognome ? String(cognome).trim() : null,
      email: emailNorm,
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

    // 1. Dedup esplicito su email_id (stesso messaggio Gmail già processato)
    if (email_id) {
      const { data: dupEmail } = await sb.from("leads").select("id").eq("email_id", email_id).maybeSingle();
      if (dupEmail) return res.status(200).json({ ok: true, duplicate: true, reason: "email_id", id: dupEmail.id });
    }

    // 2. Dedup intelligente: stessa email o stesso telefono normalizzato negli ultimi 60 giorni
    const sinceIso = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
    const orFilter = [];
    if (emailNorm) orFilter.push(`email.eq.${emailNorm}`);
    if (telNorm) orFilter.push(`telefono_normalizzato.eq.${telNorm}`);

    if (orFilter.length) {
      const { data: dups } = await sb
        .from("leads")
        .select("id, nome, cognome, numero_riinvii, created_at")
        .or(orFilter.join(","))
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1);

      if (dups && dups.length > 0) {
        const existing = dups[0];
        // Aggiorna il lead esistente: incrementa contatore riinvii + aggiorna messaggio se presente
        const patch = {
          numero_riinvii: (existing.numero_riinvii || 0) + 1,
          ultimo_riinvio_at: new Date().toISOString(),
        };
        // Se è arrivato un messaggio nuovo, lo aggiungiamo in coda al precedente
        if (messaggio) patch.messaggio = messaggio;
        await sb.from("leads").update(patch).eq("id", existing.id);
        return res.status(200).json({ ok: true, duplicate: true, reason: "email_or_telefono", id: existing.id });
      }
    }

    // 3. Nessun duplicato → insert nuovo
    const { data, error } = await sb.from("leads").insert(payload).select().single();
    if (error) {
      if (error.code === "23505") return res.status(200).json({ ok: true, duplicate: true });
      console.error("[lead-webhook] supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, id: data?.id });
  } catch (err) {
    console.error("[lead-webhook] exception:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
