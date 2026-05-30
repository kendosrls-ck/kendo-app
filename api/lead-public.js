// /api/lead-public
// Riceve POST dal form pubblico della landing /prova-gratuita.
// NESSUN secret richiesto (è pubblico), ma:
//   - rate limit minimo via timestamp (anti-spam soft)
//   - validazione email + telefono italiano
//   - validazione campo honeypot (anti-bot)
//   - origine impostata a "Landing"
// Inserisce in `leads` come stato "nuovo".

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: "Supabase env not configured" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { nome, cognome, email, telefono, obiettivo, note, honeypot, formStartedAt } = body;

    // Anti-bot 1: honeypot
    if (honeypot && String(honeypot).length > 0) {
      return res.status(200).json({ ok: true });
    }
    // Anti-bot 2: form compilato troppo velocemente (< 2 secondi)
    if (formStartedAt && Date.now() - Number(formStartedAt) < 2000) {
      return res.status(200).json({ ok: true });
    }

    // Validazioni
    if (!nome || String(nome).trim().length < 2) {
      return res.status(400).json({ error: "Nome troppo corto" });
    }
    const tel = telefono ? String(telefono).replace(/[^0-9]/g, "") : null;
    if (!tel || tel.length < 8) {
      return res.status(400).json({ error: "Telefono non valido" });
    }
    if (email && !/^[\w.+\-]+@[\w\-]+\.[\w\-.]+$/.test(email)) {
      return res.status(400).json({ error: "Email non valida" });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const emailNorm = email ? String(email).trim().toLowerCase() : null;

    const payload = {
      nome: String(nome).trim(),
      cognome: cognome ? String(cognome).trim() : null,
      email: emailNorm,
      cellulare: telefono,
      telefono_normalizzato: tel,
      fonte: "Landing",
      campagna: "prova-gratuita",
      messaggio: [obiettivo ? `Obiettivo: ${obiettivo}` : null, note || null].filter(Boolean).join(" — ") || null,
      stato: "nuovo",
      email_id: `landing_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    };

    // DEDUP intelligente: stessa email o stesso telefono normalizzato negli ultimi 60 giorni
    const sinceIso = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
    const orFilter = [];
    if (emailNorm) orFilter.push(`email.eq.${emailNorm}`);
    if (tel) orFilter.push(`telefono_normalizzato.eq.${tel}`);

    if (orFilter.length) {
      const { data: dups } = await sb
        .from("leads")
        .select("id, numero_riinvii")
        .or(orFilter.join(","))
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1);

      if (dups && dups.length > 0) {
        const existing = dups[0];
        const patch = {
          numero_riinvii: (existing.numero_riinvii || 0) + 1,
          ultimo_riinvio_at: new Date().toISOString(),
        };
        if (payload.messaggio) patch.messaggio = payload.messaggio;
        await sb.from("leads").update(patch).eq("id", existing.id);
        // Risposta OK per non confondere l'utente del form ("hai già richiesto info, ti ricontatteremo")
        return res.status(200).json({ ok: true, duplicate: true, id: existing.id });
      }
    }

    const { data, error } = await sb.from("leads").insert(payload).select().single();
    if (error) {
      console.error("Insert lead landing error:", error);
      return res.status(500).json({ error: "Impossibile salvare la richiesta" });
    }

    return res.status(200).json({ ok: true, id: data?.id });
  } catch (e) {
    console.error("Lead public exception:", e);
    return res.status(500).json({ error: "Errore server" });
  }
}
