// /api/bia-vision
// Riceve un'immagine o PDF di referto BIA, la manda a Claude Vision, ritorna i dati estratti in JSON.
//
// Input atteso (POST application/json):
//   { fileBase64: "...", mediaType: "image/jpeg" | "image/png" | "application/pdf" }
//
// Output:
//   { peso, altezza, eta, grasso_perc, massa_grassa_kg, massa_muscolare_kg, acqua_perc, bmi, metabolismo_basale, note }
//
// Richiede env: ANTHROPIC_API_KEY

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
    const { fileBase64, mediaType } = body;

    if (!fileBase64 || !mediaType) {
      return res.status(400).json({ error: "fileBase64 e mediaType obbligatori" });
    }

    const isPdf = mediaType === "application/pdf";
    const isImg = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType);
    if (!isPdf && !isImg) {
      return res.status(400).json({ error: "Formato non supportato. Usa JPG, PNG, WEBP o PDF" });
    }

    const systemPrompt = `Sei un assistente che estrae dati da referti di bioimpedenziometria (BIA) per uno studio fitness.
Estrai SOLO i valori che vedi chiaramente sul referto. Se un valore non è presente o non sei sicuro, metti null (non inventare numeri).
Rispondi ESCLUSIVAMENTE con un JSON valido, senza testo aggiuntivo, senza markdown, senza backticks.`;

    const userPrompt = `Estrai i dati di questa BIA dal referto. Schema JSON richiesto:
{
  "peso": number|null,         // kg (es. 72.5)
  "altezza": number|null,      // cm (es. 175)
  "eta": number|null,          // anni
  "grasso_perc": number|null,  // % di grasso corporeo
  "massa_grassa_kg": number|null,
  "massa_muscolare_kg": number|null,
  "acqua_perc": number|null,   // % acqua totale corporea
  "bmi": number|null,
  "metabolismo_basale": number|null, // kcal/giorno
  "obiettivo": string|null,    // se indicato sul referto
  "note": string|null          // eventuali anomalie/osservazioni utili dell'IA
}
Rispondi SOLO con il JSON, niente altro.`;

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
        // Per supporto PDF su API: header beta richiesto in alcuni casi (Claude 3.5+)
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

    // Estrae solo il JSON (tollerante a eventuali backticks o testo extra)
    let jsonStr = text.trim();
    const m = jsonStr.match(/\{[\s\S]*\}/);
    if (m) jsonStr = m[0];

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      return res.status(500).json({ error: "IA ha risposto in formato non JSON", raw: text.slice(0, 500) });
    }

    return res.status(200).json({ ok: true, data: parsed });
  } catch (e) {
    console.error("bia-vision exception:", e);
    return res.status(500).json({ error: "Errore server: " + e.message });
  }
}
