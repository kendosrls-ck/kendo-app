// /api/documento-vision
// Estrae dati da foto/PDF di certificati medici o tessere di iscrizione palestra.
// Riconosce automaticamente il tipo e ritorna i campi rilevanti.
//
// Input (POST application/json):
//   { fileBase64: "...", mediaType: "image/jpeg|image/png|application/pdf", tipo?: "certificato_medico"|"iscrizione" }
//
// Output:
//   {
//     tipo_rilevato: "certificato_medico" | "iscrizione" | "sconosciuto",
//     dati: {
//       nome: string|null,
//       cognome: string|null,
//       data_emissione: "YYYY-MM-DD"|null,
//       data_scadenza: "YYYY-MM-DD"|null,
//       tipo_certificato: "agonistico"|"non_agonistico"|null,
//       numero_tessera: string|null,
//       note: string|null,
//     }
//   }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY non configurata" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { fileBase64, mediaType, tipo } = body;

    if (!fileBase64 || !mediaType) {
      return res.status(400).json({ error: "fileBase64 e mediaType obbligatori" });
    }

    const isPdf = mediaType === "application/pdf";
    const isImg = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType);
    if (!isPdf && !isImg) {
      return res.status(400).json({ error: "Formato non supportato. JPG, PNG, WEBP, PDF" });
    }

    const tipoHint = tipo === "certificato_medico" ? "Questo è un CERTIFICATO MEDICO." :
                     tipo === "iscrizione" ? "Questo è una TESSERA DI ISCRIZIONE." :
                     "Identifica automaticamente se è un certificato medico o una tessera di iscrizione palestra.";

    const systemPrompt = `Sei un assistente che estrae dati da documenti di una palestra/centro fitness italiano.
Estrai SOLO i valori che vedi chiaramente. Se un dato non è presente o non sei sicuro, metti null (non inventare).
Le date in formato ISO YYYY-MM-DD.
Rispondi ESCLUSIVAMENTE con un JSON valido senza testo aggiuntivo, senza markdown, senza backticks.`;

    const userPrompt = `${tipoHint}

Schema JSON richiesto:
{
  "tipo_rilevato": "certificato_medico" | "iscrizione" | "sconosciuto",
  "dati": {
    "nome": string|null,
    "cognome": string|null,
    "data_emissione": "YYYY-MM-DD"|null,
    "data_scadenza": "YYYY-MM-DD"|null,
    "tipo_certificato": "agonistico"|"non_agonistico"|null,
    "numero_tessera": string|null,
    "note": string|null
  }
}

Note importanti:
- Un certificato medico di idoneità sportiva ha la "data scadenza" tipicamente 1 anno dopo la data di emissione/visita.
- "agonistico" se riporta termini come "attività agonistica", "agonistica", "competizione" — altrimenti "non_agonistico" per "non agonistica", "attività ludico-motoria", "non competitiva".
- La tessera di iscrizione ha tipicamente una validità annuale.

Rispondi SOLO con il JSON.`;

    const messageContent = [
      {
        type: isPdf ? "document" : "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: fileBase64,
        },
      },
      { type: "text", text: userPrompt },
    ];

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        ...(isPdf ? { "anthropic-beta": "pdfs-2024-09-25" } : {}),
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("Anthropic error:", r.status, txt);
      return res.status(502).json({ error: "Errore IA: " + r.status, detail: txt.slice(0, 500) });
    }

    const data = await r.json();
    const text = data?.content?.[0]?.text || "";

    let jsonStr = text.trim();
    const m = jsonStr.match(/\{[\s\S]*\}/);
    if (m) jsonStr = m[0];

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      return res.status(500).json({ error: "IA ha risposto in formato non JSON", raw: text.slice(0, 500) });
    }

    return res.status(200).json({ ok: true, ...parsed });
  } catch (e) {
    console.error("documento-vision exception:", e);
    return res.status(500).json({ error: "Errore server: " + e.message });
  }
}
