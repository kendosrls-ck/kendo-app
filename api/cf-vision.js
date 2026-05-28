// /api/cf-vision
// Estrae i dati anagrafici dalla foto di una tessera sanitaria / codice fiscale
// usando Claude AI Vision.
//
// Input (POST application/json):
//   { fileBase64: "...", mediaType: "image/jpeg|image/png|image/webp" }
//
// Output:
//   {
//     ok: true,
//     dati: {
//       nome: string|null,
//       cognome: string|null,
//       codice_fiscale: string|null,
//       data_nascita: "YYYY-MM-DD"|null,
//       luogo_nascita: string|null,
//       sesso: "M"|"F"|null,
//       numero_documento: string|null,   // numero tessera sanitaria
//       data_scadenza_documento: "YYYY-MM-DD"|null
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
    const { fileBase64, mediaType } = body;

    if (!fileBase64 || !mediaType) {
      return res.status(400).json({ error: "fileBase64 e mediaType obbligatori" });
    }

    const isImg = ["image/jpeg", "image/png", "image/webp"].includes(mediaType);
    if (!isImg) {
      return res.status(400).json({ error: "Formato non supportato. Usa JPG, PNG o WEBP" });
    }

    const systemPrompt = `Sei un assistente che estrae i dati anagrafici da foto di tessere sanitarie italiane, codici fiscali o carte d'identità.
Estrai SOLO i dati che vedi chiaramente. Se un dato non è visibile o non sei sicuro, metti null (non inventare).
Le date sono in formato ISO YYYY-MM-DD.
Il codice fiscale italiano è sempre 16 caratteri alfanumerici maiuscoli.
Rispondi ESCLUSIVAMENTE con un JSON valido senza testo aggiuntivo, senza markdown, senza backticks.`;

    const userPrompt = `Estrai i dati anagrafici dalla foto del documento.

Schema JSON richiesto:
{
  "dati": {
    "nome": string|null,
    "cognome": string|null,
    "codice_fiscale": string|null,
    "data_nascita": "YYYY-MM-DD"|null,
    "luogo_nascita": string|null,
    "sesso": "M"|"F"|null,
    "numero_documento": string|null,
    "data_scadenza_documento": "YYYY-MM-DD"|null
  }
}

Note:
- Per la TESSERA SANITARIA: "numero_documento" è il numero della tessera (Identificativo Tessera o TEAM), tipicamente 20 cifre.
- Per la CARTA D'IDENTITA': "numero_documento" è il numero del documento (CA12345AB o simili).
- Il "luogo_nascita" è la città/comune di nascita (senza sigla provincia).
- Se vedi solo il retro della tessera sanitaria europea con un codice fiscale, compila solo i campi visibili.
- Tutti i campi testo in MAIUSCOLO.

Rispondi SOLO con il JSON.`;

    const messageContent = [
      {
        type: "image",
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
    console.error("cf-vision exception:", e);
    return res.status(500).json({ error: "Errore server: " + e.message });
  }
}
