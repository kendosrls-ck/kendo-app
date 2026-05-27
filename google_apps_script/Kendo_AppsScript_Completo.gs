/**
 * KENDO - Script Gmail COMPLETO (lead + import clienti)
 *
 * Questo unico file contiene DUE automazioni indipendenti:
 *   1) processaLead()    → legge le email "NUOVO LEAD" e crea i lead in Kendo (ogni 5-10 min)
 *   2) importaClienti()  → legge le email "Export analisi clienti" con CSV e aggiorna i clienti (ogni 30 min)
 *
 * COME INSTALLARE:
 *   1. https://script.google.com → apri il progetto (o creane uno nuovo)
 *   2. Incolla TUTTO questo file in Codice.gs (sostituendo quello presente)
 *   3. Salva (Ctrl+S)
 *   4. Esegui "testConnessione" e "testMarketingWebhook" per verificare (autorizza Gmail)
 *   5. Crea DUE trigger (icona orologio a sinistra → + Aggiungi trigger):
 *      - Funzione: processaLead    → Tempo → ogni 5 (o 10) minuti
 *      - Funzione: importaClienti  → Tempo → ogni 30 minuti
 *   6. Salva. Da ora girano entrambi da soli.
 */

// ════════════════════════════════════════════════════════════════
//  PARTE 1 — LEAD (email "NUOVO LEAD" → /api/lead-webhook)
// ════════════════════════════════════════════════════════════════

const CONFIG = {
  WEBHOOK_URL: "https://kendo-app-weld.vercel.app/api/lead-webhook",
  SECRET: "kendo-VxIPNeH0Ar1gbiOIdna4M9EWHhnqGyQd",
  PROCESSED_LABEL: "KendoProcessed",
  FILTER_LABEL: "",
  KNOWN_SENDERS: ["shoma", "fitandgo", "noreply@", "info@", "lead", "contatto", "form"],
  SUBJECT_KEYWORDS: ["lead", "nuovo contatto", "nuova richiesta", "richiesta info", "prova gratuita", "form contatti", "ha richiesto"],
  MAX_PER_RUN: 30,
  DAYS_BACK: 7,
};

function processaLead() {
  const label = getOrCreateLabel(CONFIG.PROCESSED_LABEL);
  const dateFilter = "newer_than:" + CONFIG.DAYS_BACK + "d";
  const labelFilter = "-label:" + CONFIG.PROCESSED_LABEL;
  let query = dateFilter + " " + labelFilter + " in:inbox";
  if (CONFIG.FILTER_LABEL) query += " label:" + CONFIG.FILTER_LABEL;

  const threads = GmailApp.search(query, 0, CONFIG.MAX_PER_RUN);
  Logger.log("Trovate " + threads.length + " conversazioni da analizzare");
  let inviati = 0, scartati = 0;

  for (var t = 0; t < threads.length; t++) {
    const thread = threads[t];
    const messages = thread.getMessages();
    for (var m = 0; m < messages.length; m++) {
      const msg = messages[m];
      try {
        const lead = parseLeadFromMessage(msg);
        if (!lead) { scartati++; continue; }
        const ok = postToWebhook(lead);
        if (ok) { inviati++; thread.addLabel(label); }
        else Logger.log("Errore POST per email " + msg.getId());
      } catch (e) {
        Logger.log("Errore su messaggio " + msg.getId() + ": " + e.message);
      }
    }
  }
  Logger.log("Run lead: " + inviati + " inviati, " + scartati + " non-lead.");
}

function parseLeadFromMessage(msg) {
  const from = (msg.getFrom() || "").toLowerCase();
  const subject = (msg.getSubject() || "").toLowerCase();
  const body = msg.getPlainBody() || "";

  const senderOk = CONFIG.KNOWN_SENDERS.some(s => from.indexOf(s) !== -1);
  const subjectOk = CONFIG.SUBJECT_KEYWORDS.some(s => subject.indexOf(s) !== -1);
  if (!senderOk && !subjectOk) return null;
  // Esclude le email "Export analisi clienti" (gestite dall'altra automazione)
  if (subject.indexOf("export analisi clienti") !== -1) return null;

  const nome = extractField(body, ["nome", "name", "first name"]);
  const cognome = extractField(body, ["cognome", "surname", "last name"]);
  const email = extractEmail(body);
  var telRaw = extractField(body, ["cellulare", "telefono", "cell", "tel", "phone", "mobile", "numero"]);
  var tel = telRaw ? cleanPhoneValue(telRaw) : extractPhone(body);
  const fonte = extractField(body, ["fonte", "provenienza", "come ci hai conosciuto", "source"]) || guessFonte(subject, from);
  const negozio = extractField(body, ["negozio", "store", "centro", "sede"]);
  const obiettivo = extractField(body, ["tecnologia scelta", "tecnologia", "obiettivo", "interesse"]);
  const messaggio = extractField(body, ["messaggio", "message", "richiesta", "note"]) || obiettivo;

  if (!nome && !email && !tel) return null;

  return {
    nome: nome || (email ? email.split("@")[0] : "Lead senza nome"),
    cognome: cognome,
    email: email,
    telefono: tel,
    fonte: fonte || guessFonte(subject, from) || "Gmail",
    campagna: extractField(body, ["campagna", "campaign"]) || negozio,
    messaggio: messaggio,
    email_subject: msg.getSubject(),
    email_received_at: msg.getDate().toISOString(),
    email_id: msg.getId(),
  };
}

function extractField(body, labels) {
  const lines = body.split(/\r?\n/);
  for (var i = 0; i < labels.length; i++) {
    var label = labels[i].toLowerCase();
    var re1 = new RegExp("^\\s*" + escapeRegex(label) + "\\s*[:\\-]\\s*(.+?)\\s*$", "im");
    for (var j = 0; j < lines.length; j++) {
      var m = lines[j].match(re1);
      if (m && m[1]) return cleanValue(m[1]);
    }
    for (var j = 0; j < lines.length - 1; j++) {
      if (new RegExp("^\\s*" + escapeRegex(label) + "\\s*[:\\-]?\\s*$", "i").test(lines[j])) {
        var v = (lines[j + 1] || "").trim();
        if (v && !v.includes(":")) return cleanValue(v);
      }
    }
  }
  return null;
}

function extractEmail(body) {
  var m = body.match(/[\w.+\-]+@[\w\-]+\.[\w\-.]+/);
  return m ? m[0] : null;
}

function cleanPhoneValue(raw) {
  if (!raw) return null;
  var s = String(raw).replace(/[^0-9+]/g, "");
  if (s.length < 8) return null;
  return s;
}

function extractPhone(body) {
  var patterns = [
    /\+39[\s.\-]?\d{2,3}[\s.\-]?\d{3}[\s.\-]?\d{3,4}/,
    /\b0039\d{8,11}\b/,
    /\b39\d{9,10}\b/,
    /\b3\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3,4}\b/,
    /\+\d{1,3}[\s.\-]?\d{6,12}/,
    /\b\d{9,10}\b/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = body.match(patterns[i]);
    if (m) return m[0].replace(/[\s.\-]/g, "");
  }
  return null;
}

function guessFonte(subject, from) {
  if (subject.indexOf("instagram") !== -1 || from.indexOf("instagram") !== -1) return "Instagram";
  if (subject.indexOf("facebook") !== -1 || from.indexOf("facebook") !== -1) return "Facebook";
  if (subject.indexOf("sito") !== -1) return "Sito web";
  if (subject.indexOf("shoma") !== -1 || from.indexOf("shoma") !== -1) return "Shoma";
  if (subject.indexOf("fit") !== -1 && subject.indexOf("go") !== -1) return "Fit & Go";
  return null;
}

function cleanValue(v) {
  return String(v || "").trim().replace(/^["']|["']$/g, "").substring(0, 500);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function postToWebhook(lead) {
  var options = {
    method: "post", contentType: "application/json",
    headers: { "x-kendo-secret": CONFIG.SECRET },
    payload: JSON.stringify(lead), muteHttpExceptions: true,
  };
  try {
    var response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) { Logger.log("OK lead: " + (lead.nome || lead.email)); return true; }
    Logger.log("HTTP " + code + ": " + response.getContentText());
    return false;
  } catch (e) { Logger.log("Eccezione fetch lead: " + e.message); return false; }
}

function getOrCreateLabel(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

function testConnessione() {
  var lead = {
    nome: "Mario", cognome: "Test", email: "test@example.com", telefono: "+393331234567",
    fonte: "TEST", messaggio: "Lead di test", email_subject: "TEST CONNESSIONE",
    email_received_at: new Date().toISOString(), email_id: "TEST_" + new Date().getTime(),
  };
  var ok = postToWebhook(lead);
  Logger.log(ok ? "OK lead webhook" : "FALLITO lead webhook");
}


// ════════════════════════════════════════════════════════════════
//  PARTE 2 — IMPORT CLIENTI (email "Export analisi clienti" CSV → /api/marketing-webhook)
// ════════════════════════════════════════════════════════════════

const MKT_CONFIG = {
  WEBHOOK_URL: "https://kendo-app-weld.vercel.app/api/marketing-webhook",
  SECRET: "kendo-VxIPNeH0Ar1gbiOIdna4M9EWHhnqGyQd",
  PROCESSED_LABEL: "KendoMarketingProcessed",
  SUBJECT_MATCH: "export analisi clienti",
  NEGOZIO: "FIT Padova",
  DAYS_BACK: 7,
  MAX_PER_RUN: 5,
};

function importaClienti() {
  const label = getOrCreateLabelMkt(MKT_CONFIG.PROCESSED_LABEL);
  const query = 'newer_than:' + MKT_CONFIG.DAYS_BACK + 'd -label:' + MKT_CONFIG.PROCESSED_LABEL +
                ' subject:("Export analisi clienti") has:attachment';
  const threads = GmailApp.search(query, 0, MKT_CONFIG.MAX_PER_RUN);
  Logger.log("Trovate " + threads.length + " email 'Export analisi clienti'");

  var processate = 0;
  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var messages = thread.getMessages();
    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      var subject = (msg.getSubject() || "").toLowerCase();
      if (subject.indexOf(MKT_CONFIG.SUBJECT_MATCH) === -1) continue;

      var attachments = msg.getAttachments();
      var csvText = null;
      for (var a = 0; a < attachments.length; a++) {
        var att = attachments[a];
        var name = (att.getName() || "").toLowerCase();
        var type = att.getContentType() || "";
        if (name.indexOf(".csv") !== -1 || type.indexOf("csv") !== -1 || type.indexOf("text/plain") !== -1) {
          csvText = att.getDataAsString("UTF-8");
          if (csvText && csvText.indexOf("�") !== -1) {
            try { csvText = att.getDataAsString("ISO-8859-1"); } catch (e) {}
          }
          break;
        }
      }
      if (!csvText) { Logger.log("Nessun CSV valido in: " + msg.getSubject()); continue; }

      var ok = postCsvWebhook(csvText);
      if (ok) { thread.addLabel(label); processate++; Logger.log("OK import: " + msg.getSubject()); }
      else Logger.log("Errore import: " + msg.getSubject());
    }
  }
  Logger.log("Run import: " + processate + " file CSV importati.");
}

function postCsvWebhook(csvText) {
  var options = {
    method: "post", contentType: "application/json",
    headers: { "x-kendo-secret": MKT_CONFIG.SECRET },
    payload: JSON.stringify({ csv: csvText, negozio: MKT_CONFIG.NEGOZIO }),
    muteHttpExceptions: true,
  };
  try {
    var response = UrlFetchApp.fetch(MKT_CONFIG.WEBHOOK_URL, options);
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) { Logger.log("Webhook OK: " + response.getContentText()); return true; }
    Logger.log("Webhook HTTP " + code + ": " + response.getContentText());
    return false;
  } catch (e) { Logger.log("Eccezione fetch import: " + e.message); return false; }
}

function getOrCreateLabelMkt(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

function testMarketingWebhook() {
  var csvDemo = "Negozio;Nome;Surname;Email;Sms;Data_Nascita;Status CRM\n" +
                "FIT Padova;Mario;TestImport;mario.test@example.com;\"=\"\"+393331234567\"\"\";;CLIENTE ATTIVO";
  var ok = postCsvWebhook(csvDemo);
  Logger.log(ok ? "OK marketing webhook raggiungibile" : "FALLITO marketing webhook - verifica URL e SECRET");
}
