// /api/firma-pdf
// Genera un PDF con i documenti firmati per una richiesta K-Sign.
// Ritorna il PDF in base64 (per allegato email) oppure lo salva su Supabase Storage.
//
// Input POST application/json: { richiesta_id }
// Output: { ok, pdf_base64, filename }

import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ ok: false, error: "Supabase env mancante" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { richiesta_id } = body;
    if (!richiesta_id) return res.status(400).json({ ok: false, error: "richiesta_id obbligatorio" });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1. Recupera dati richiesta + firme + consensi
    const [{ data: richiesta }, { data: firme }, { data: consensi }] = await Promise.all([
      sb.from("ksign_richiesta").select("*").eq("id", richiesta_id).maybeSingle(),
      sb.from("ksign_firma").select("*").eq("richiesta_id", richiesta_id).order("firmato_at"),
      sb.from("ksign_consenso").select("*").eq("richiesta_id", richiesta_id),
    ]);
    if (!richiesta) return res.status(404).json({ ok: false, error: "Richiesta non trovata" });

    const pdfBase64 = await generaPdf(richiesta, firme || [], consensi || []);
    const filename = `kendo-firme-${(richiesta.firmatario_cognome || "cliente").replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${String(richiesta.numero_progressivo || 0).padStart(6, "0")}.pdf`;

    return res.status(200).json({ ok: true, pdf_base64: pdfBase64, filename });
  } catch (e) {
    console.error("firma-pdf exception:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

async function generaPdf(richiesta, firme, consensi) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const gold = rgb(0.831, 0.659, 0.263);
  const black = rgb(0.031, 0.031, 0.031);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.9, 0.9, 0.9);

  const A4_W = 595, A4_H = 842;
  const margin = 50;
  let page = pdfDoc.addPage([A4_W, A4_H]);
  let y = A4_H - margin;

  const nuovaPagina = () => {
    page = pdfDoc.addPage([A4_W, A4_H]);
    y = A4_H - margin;
    drawHeader();
  };

  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: A4_H - 35, width: A4_W, height: 35, color: black });
    page.drawText("KENDO", { x: margin, y: A4_H - 23, size: 14, font: fontBold, color: gold });
    page.drawText("Fit And Go Padova", { x: margin + 70, y: A4_H - 22, size: 10, font, color: rgb(0.7, 0.7, 0.7) });
    page.drawText(`Pagina ${pdfDoc.getPageCount()}`, { x: A4_W - margin - 50, y: A4_H - 22, size: 9, font, color: rgb(0.7, 0.7, 0.7) });
    y = A4_H - 60;
  };

  const ensureSpace = (needed) => {
    if (y - needed < margin) nuovaPagina();
  };

  const drawText = (txt, opts = {}) => {
    const size = opts.size || 10;
    const f = opts.bold ? fontBold : font;
    const color = opts.color || black;
    const maxWidth = opts.maxWidth || A4_W - 2 * margin;
    const words = String(txt || "").split(" ");
    let line = "";
    const lineHeight = size + 4;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth) {
        ensureSpace(lineHeight);
        page.drawText(line, { x: opts.x || margin, y, size, font: f, color });
        y -= lineHeight;
        line = w;
      } else line = test;
    }
    if (line) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: opts.x || margin, y, size, font: f, color });
      y -= lineHeight;
    }
  };

  const drawSeparator = () => {
    ensureSpace(10);
    page.drawLine({ start: { x: margin, y }, end: { x: A4_W - margin, y }, thickness: 0.5, color: lightGray });
    y -= 10;
  };

  drawHeader();

  // TITOLO
  drawText("DOCUMENTI FIRMATI", { bold: true, size: 16, color: gold });
  y -= 6;
  drawText(`${richiesta.firmatario_nome || ""} ${richiesta.firmatario_cognome || ""}`.trim(), { bold: true, size: 14 });
  drawText(`ID transazione: KS-${String(richiesta.numero_progressivo || 0).padStart(6, "0")}`, { size: 9, color: gray });
  drawText(`Data firma: ${richiesta.signed_at ? new Date(richiesta.signed_at).toLocaleString("it-IT") : "—"}`, { size: 9, color: gray });
  y -= 5;
  drawSeparator();

  // DATI CLIENTE
  drawText("DATI FIRMATARIO", { bold: true, size: 11, color: gold });
  y -= 3;
  drawText(`Nome: ${richiesta.firmatario_nome || "—"} ${richiesta.firmatario_cognome || ""}`, { size: 10 });
  drawText(`Email: ${richiesta.firmatario_email || "—"}`, { size: 10 });
  drawText(`Telefono: ${richiesta.firmatario_telefono || "—"}`, { size: 10 });
  if (richiesta.dati_compilati && Object.keys(richiesta.dati_compilati).length > 0) {
    const d = richiesta.dati_compilati;
    if (d.pacchetto) drawText(`Pacchetto: ${d.pacchetto}`, { size: 10 });
    if (d.importo) drawText(`Importo: €${d.importo}`, { size: 10 });
    if (d.metodo_pagamento) drawText(`Pagamento: ${d.metodo_pagamento}`, { size: 10 });
  }
  y -= 5;
  drawSeparator();

  // LIBERATORIA (se presente)
  if ((richiesta.template_codici || []).includes("liberatoria_fitgo")) {
    drawText("DICHIARAZIONE LIBERATORIA DI RESPONSABILITÀ", { bold: true, size: 12, color: gold });
    y -= 3;
    drawText("Il sottoscritto dichiara di essere in condizioni psicofisiche idonee all'attività di allenamento EMS / Vacufit, di non avere patologie incompatibili (epilessia, pacemaker, gravidanza, cardiopatie, ernia, problemi renali, malattie neurologiche, diabete), di non aver assunto sostanze, alcolici o farmaci nelle 48h precedenti, di conoscere i rischi dell'attività e di osservare le norme di sicurezza del centro.", { size: 9 });
    y -= 4;
    drawText("Approva specificamente, ai sensi degli artt. 1341 e 1342 del Codice Civile, le clausole vessatorie del contratto: limitazioni di responsabilità, foro competente di Padova, condizioni di recesso.", { size: 9 });
    y -= 5;
    drawSeparator();
  }

  // CONTRATTO (se presente)
  if ((richiesta.template_codici || []).includes("contratto_fitgo")) {
    drawText("CONDIZIONI GENERALI DI CONTRATTO", { bold: true, size: 12, color: gold });
    y -= 3;
    drawText("1. Tariffe e durata: contratto annuale, nominativo, non cedibile.", { size: 9 });
    drawText("2. Quote e spese: pagamento dovuto anche in caso di non utilizzo.", { size: 9 });
    drawText("3. Metodi di pagamento: carta/bancomat/PagoDIL/bonifico/contanti.", { size: 9 });
    drawText("4. Certificato medico: obbligatorio per partecipare alle attività.", { size: 9 });
    drawText("5. Responsabilità civile: il centro non risponde per furti o danni a beni personali.", { size: 9 });
    drawText("6. Foro competente: Padova.", { size: 9 });
    drawText("7. Condotta: divieti di scarpe esterne, animali, fumo, alcolici nei locali.", { size: 9 });
    y -= 5;
    drawSeparator();
  }

  // CONSENSI GDPR
  if (consensi.length > 0) {
    drawText("CONSENSI GDPR (Reg. UE 2016/679)", { bold: true, size: 11, color: gold });
    y -= 3;
    for (const c of consensi) {
      const val = (c.valore || "").toUpperCase();
      const color = val === "SI" || val === "YES" ? rgb(0.16, 0.62, 0.43) : rgb(0.75, 0.23, 0.17);
      ensureSpace(15);
      page.drawText(`${c.etichetta || "—"}:`, { x: margin, y, size: 9, font, color: black });
      page.drawText(val, { x: margin + 350, y, size: 9, font: fontBold, color });
      y -= 14;
    }
    y -= 3;
    drawSeparator();
  }

  // FIRME APPOSTE (immagini)
  drawText("FIRME APPOSTE", { bold: true, size: 12, color: gold });
  y -= 5;

  for (const firma of firme) {
    ensureSpace(120);
    drawText(firma.etichetta || `Firma ${firma.codice_firma || ""}`, { bold: true, size: 10 });
    drawText(`Firmata il ${firma.firmato_at ? new Date(firma.firmato_at).toLocaleString("it-IT") : "—"}`, { size: 8, color: gray });
    y -= 5;
    // Embed dell'immagine firma se presente
    if (firma.dato_png_base64) {
      try {
        const dataStr = firma.dato_png_base64.replace(/^data:image\/png;base64,/, "");
        const imgBytes = Uint8Array.from(atob(dataStr), c => c.charCodeAt(0));
        const img = await pdfDoc.embedPng(imgBytes);
        const sigW = 200, sigH = (img.height / img.width) * sigW;
        ensureSpace(sigH + 10);
        // Box bordo
        page.drawRectangle({ x: margin, y: y - sigH, width: sigW, height: sigH, borderColor: lightGray, borderWidth: 0.5 });
        page.drawImage(img, { x: margin, y: y - sigH, width: sigW, height: sigH });
        y -= sigH + 12;
      } catch (e) {
        drawText("(immagine firma non disponibile)", { size: 8, color: gray });
      }
    } else {
      drawText("(firma registrata senza immagine)", { size: 8, color: gray });
    }
    y -= 8;
  }

  drawSeparator();

  // FOOTER LEGALE
  ensureSpace(80);
  drawText("VALIDITÀ LEGALE", { bold: true, size: 10, color: gold });
  drawText("Questo documento è stato firmato elettronicamente tramite il sistema K-Sign integrato nella piattaforma Kendo SRLS. Tutte le firme, i consensi e le interazioni sono conservati con audit log immutabile conforme al regolamento eIDAS (Reg. UE 910/2014). Il documento ha piena validità legale.", { size: 8, color: gray });
  y -= 4;
  drawText(`Documento generato automaticamente il ${new Date().toLocaleString("it-IT")} - Kendo SRLS · Fit And Go Padova`, { size: 7, color: gray });

  // Serializza
  const bytes = await pdfDoc.save();
  // Converti in base64
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return Buffer.from(binary, "binary").toString("base64");
}
