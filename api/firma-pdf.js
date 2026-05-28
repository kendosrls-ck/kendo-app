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
  drawText(`Nome e Cognome: ${richiesta.firmatario_nome || "—"} ${richiesta.firmatario_cognome || ""}`, { size: 10 });
  if (richiesta.luogo_nascita || richiesta.data_nascita) {
    const ln = richiesta.luogo_nascita || "—";
    const dn = richiesta.data_nascita ? new Date(richiesta.data_nascita).toLocaleDateString("it-IT") : "—";
    drawText(`Luogo e data di nascita: ${ln} - ${dn}`, { size: 10 });
  }
  if (richiesta.codice_fiscale) drawText(`Codice Fiscale: ${richiesta.codice_fiscale}`, { size: 10 });
  if (richiesta.indirizzo || richiesta.citta) {
    const ind = richiesta.indirizzo || "—";
    const cit = richiesta.citta || "—";
    const cap = richiesta.cap || "";
    const pr = richiesta.provincia ? `(${richiesta.provincia})` : "";
    drawText(`Indirizzo: ${ind}, ${cap} ${cit} ${pr}`.trim(), { size: 10 });
  }
  drawText(`Email: ${richiesta.firmatario_email || "—"}`, { size: 10 });
  drawText(`Telefono: ${richiesta.firmatario_telefono || "—"}`, { size: 10 });
  if (richiesta.occupazione) drawText(`Occupazione: ${richiesta.occupazione}`, { size: 10 });
  if (richiesta.tipo_documento || richiesta.numero_documento) {
    const tdMap = { carta_identita: "Carta d'identità", patente: "Patente", passaporto: "Passaporto", tessera_sanitaria: "Tessera sanitaria" };
    const td = tdMap[richiesta.tipo_documento] || richiesta.tipo_documento || "Documento";
    drawText(`${td}: ${richiesta.numero_documento || "—"}`, { size: 10 });
  }
  if (richiesta.come_conosciuto) {
    const ckMap = {
      insegna_passaggio: "Insegna / passaggio", internet: "Internet / sito web",
      pubblicita_tradizionale: "Pubblicità tradizionale", volantinaggio: "Volantinaggio",
      social_network: "Social network", amico: "Amico", altro: "Altro",
    };
    drawText(`Come ha conosciuto Fit And Go: ${ckMap[richiesta.come_conosciuto] || richiesta.come_conosciuto}`, { size: 10 });
  }
  if (richiesta.preferenza_comunicazione) drawText(`Preferenza comunicazioni: ${richiesta.preferenza_comunicazione.toUpperCase()}`, { size: 10 });
  if (richiesta.dati_compilati && Object.keys(richiesta.dati_compilati).length > 0) {
    const d = richiesta.dati_compilati;
    if (d.pacchetto) drawText(`Pacchetto: ${d.pacchetto}`, { size: 10 });
    if (d.importo) drawText(`Importo: €${d.importo}`, { size: 10 });
    if (d.metodo_pagamento) drawText(`Pagamento: ${d.metodo_pagamento}`, { size: 10 });
  }
  y -= 5;
  drawSeparator();

  // LIBERATORIA (testo ufficiale Fit And Go)
  if ((richiesta.template_codici || []).includes("liberatoria_fitgo")) {
    nuovaPagina();
    drawText("DICHIARAZIONE LIBERATORIA DI RESPONSABILITA'", { bold: true, size: 12, color: gold });
    y -= 4;
    drawText("Il/la sottoscritto/a dichiara di essere in possesso di certificazione medica per l'idoneità all'attività sportiva non agonistica, di sana e robusta costituzione.", { size: 9 });
    y -= 4;
    drawText("DICHIARA INOLTRE:", { bold: true, size: 10 });
    y -= 2;
    drawText("1. Di essere in condizioni psicofisiche idonee per l'attività in questione.", { size: 9 });
    drawText("2. Di non avere: epilessia, pacemaker cardiaco, gravidanza, malattie cardiache e cardiovascolari, ernia addominale o inguinale, problemi renali, tubercolosi, malattie tumorali, arteriosclerosi in stadio avanzato, disturbi arteriosi della circolazione sanguigna, malattie neurologiche, diabete mellito, malattie febbrili, acuti processi batterici e virali, sanguinamenti, tendenza al sanguinamento pesante (emofilia), malattie della pelle.", { size: 9 });
    drawText("3. Di non aver assunto e di non assumere, nelle 48 ore precedenti la lezione, sostanze stupefacenti e/o psicotrope, di non essere sotto l'effetto di farmaci, di non aver ecceduto nel consumo di bevande alcoliche e cibo, ma di essermi nutrito ed idratato a sufficienza (almeno 0,5 l di acqua o di bevande minerali).", { size: 9 });
    drawText("4. Di essere a conoscenza dei rischi, prevedibili ed imprevedibili, connessi alla pratica dell'attività pur non potendosi considerare tale un'attività potenzialmente pericolosa.", { size: 9 });
    drawText("5. Di conoscere e di attenermi prima, durante e dopo l'attività, a tutte le norme, disposizioni di sicurezza e limitazioni concesse e relative alla tecnica delle attività svolte nel centro, anche in considerazione del proprio livello di tenuta fisica e di esperienza.", { size: 9 });
    drawText("6. Di assumermi, sin da ora, ogni e qualsiasi responsabilità riguardo la mia persona per danni procurati ad altri (e/o a cose) a causa di un comportamento non conforme alle norme di buona tecnica dell'attività od obiettivamente irresponsabile.", { size: 9 });
    drawText("7. Di aver letto e valutato attentamente il contenuto del presente documento e di aver compreso chiaramente il significato di ogni punto prima di sottoscriverlo. A tal fine dichiaro di esonerare Fit & Go Srl da qualsiasi responsabilità in ordine all'esecuzione dell'attività.", { size: 9 });
    y -= 4;
    drawText("Agli effetti degli artt. 1341 e 1342 del Codice Civile, dichiaro di approvare specificatamente i punti: 1, 2, 3, 4, 5, 6, 7 della presente scrittura.", { bold: true, size: 9 });
    y -= 5;
    drawSeparator();
  }

  // CONTRATTO (testo ufficiale Fit And Go)
  if ((richiesta.template_codici || []).includes("contratto_fitgo")) {
    nuovaPagina();
    drawText("CONDIZIONI GENERALI DI CONTRATTO FIT AND GO", { bold: true, size: 12, color: gold });
    y -= 4;
    drawText("Il presente contratto disciplina il rapporto contrattuale tra il CLIENTE e KENDO SRLS che utilizza il marchio FIT AND GO per la fornitura dei servizi previsti dal contratto.", { size: 9 });
    y -= 4;
    drawText("1. TARIFFE E DURATA", { bold: true, size: 10 });
    drawText("Il presente contratto ha durata annuale e si rinnova con il pagamento dell'iscrizione. La decorrenza inizia dalla data di sottoscrizione. Il contratto è nominativo e non cedibile ad altra persona e/o cliente. Pacchetti disponibili: Abbonamento Mensile, Trimestrale, Semestrale, Annuale, Misto (EMS/Sintesi/Vacufit/Vacustep), Carnet 10 o 25 sessioni, Criofit (10/25 sedute o Unlimited 1/6 mesi), Open 1/6/12 mesi. La durata decorre dalla data del primo allenamento. Tutte le sedute devono essere disdette almeno 24 ore prima, altrimenti vengono scalate.", { size: 9 });
    y -= 4;
    drawText("2. QUOTE E SPESE", { bold: true, size: 10 });
    drawText("L'obbligo al pagamento delle quote sussiste anche nel caso in cui il Cliente non possa usufruire delle prestazioni, salvo gravidanza, malattie gravi o infortuni di durata maggiore a 6 mesi certificati, impedimenti lavorativi superiori a 2 mesi certificati. Sospensione facoltativa fino a 60 giorni con preavviso scritto di 30 giorni. In caso di ritardo nei pagamenti superiore a 2 settimane FIT AND GO può risolvere il contratto e adire vie legali.", { size: 9 });
    y -= 4;
    drawText("3. METODI DI PAGAMENTO", { bold: true, size: 10 });
    drawText("Carta di credito, bancomat, PagoDIL/APPAGO, Service Pay, assegno, bonifico, contanti. Spese bancarie per addebiti non andati a buon fine a carico del Cliente. Dopo il secondo tentativo di addebito non riuscito, FIT AND GO può disdire l'abbonamento.", { size: 9 });
    y -= 4;
    drawText("4. REGOLAMENTO INTERNO", { bold: true, size: 10 });
    drawText("Il Cliente dichiara di aver preso visione del regolamento interno esposto in reception. La mancata osservanza dopo un'ammonizione comporta risoluzione immediata del contratto, senza diritto al rimborso delle sessioni non effettuate.", { size: 9 });
    y -= 4;
    drawText("5. INFORMAZIONE SANITARIA", { bold: true, size: 10 });
    drawText("Il Cliente dichiara di essere in buona salute psico-fisica, di essere idoneo alla pratica sportiva non agonistica e all'uso di macchinari EMS e Criosauna. È OBBLIGATORIA la consegna di certificazione medica in originale non autocertificata, da rinnovarsi ogni 12 mesi.", { size: 9 });
    y -= 4;
    drawText("6. RESPONSABILITA' CIVILE", { bold: true, size: 10 });
    drawText("FIT AND GO non offre servizio di custodia dei beni del Cliente e non risponde per furti, danni o smarrimenti. Per danni alle attrezzature o a persone causati da uso indebito, il Cliente sarà ritenuto responsabile.", { size: 9 });
    y -= 4;
    drawText("7. FORO COMPETENTE", { bold: true, size: 10 });
    drawText("Per ogni controversia relativa al presente contratto è competente il foro di Padova.", { size: 9 });
    y -= 4;
    drawText("8. CONDOTTA DEL CLIENTE", { bold: true, size: 10 });
    drawText("All'interno di FIT AND GO è tassativamente vietato: indossare scarpe da ginnastica usate anche all'esterno, introdurre animali, fumare, bere alcolici, fare uso di sostanze stupefacenti, mangiare (salvo prodotti FIT AND GO). Richiesto abbigliamento decoroso e condotta rispettosa.", { size: 9 });
    y -= 4;
    drawText("CLAUSOLE VESSATORIE (artt. 1341-1342 C.C.)", { bold: true, size: 10, color: gold });
    drawText("Si approvano espressamente le clausole 1 (Tariffe e durata), 2 (Quote e spese), 3 (Metodi di pagamento), 4 (Regolamento interno), 5 (Informazione sanitaria), 6 (Responsabilità civile), 8 (Condotta del cliente).", { bold: true, size: 9 });
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
