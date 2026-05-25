/**
 * KENDO - Gmail → Webhook lead
 *
 * Cosa fa:
 *   - Ogni 5 minuti scansiona la casella fitandgopadova@gmail.com
 *   - Cerca email NUOVE (non etichettate "KendoProcessed") con mittente o oggetto
 *     che identificano un lead
 *   - Estrae nome, cognome, telefono, email, fonte dall'email
 *   - Manda i dati al webhook https://<your-vercel-domain>/api/lead-webhook
 *   - Etichetta come "KendoProcessed" per non rielaborarla
 *
 * COME INSTALLARE (5 minuti):
 *   1. Vai su https://script.google.com  (loggato con fitandgopadova@gmail.com)
 *   2. "Nuovo progetto"
 *   3. Cancella il codice di esempio e incolla TUTTO questo file
 *   4. Modifica CONFIG sotto: imposta WEBHOOK_URL e SECRET
 *   5. Salva (icona disco) e dai un nome al progetto (es. "Kendo Lead")
 *   6. Premi "Esegui" → ti chiedera' di autorizzare l'accesso a Gmail. Concedi.
 *   7. Vai su "Trigger" (icona orologio a sinistra) → "+ Aggiungi trigger"
 *      - Funzione: processaLead
 *      - Sorgente: Tempo
 *      - Tipo: A intervalli regolari → ogni 5 minuti
 *   8. Salva. Da ora gira da solo.
 */

// ╔════════════════════════════════════════════════════════════════╗
// ║  CONFIG — MODIFICA QUI                                          ║
// ╚════════════════════════════════════════════════════════════════╝

const CONFIG = {
  // URL del webhook su Vercel (sara' dato dopo il deploy)
  WEBHOOK_URL: "https://kendo-app.vercel.app/api/lead-webhook",

  // Stesso valore impostato in Vercel come LEAD_WEBHOOK_SECRET
  SECRET: "CAMBIA_QUESTO_SECRET_CON_QUELLO_DI_VERCEL",

  // Etichetta Gmail per marcare email gia' elaborate
  PROCESSED_LABEL: "KendoProcessed",

  // Etichetta opzionale per filtrare solo certi messaggi.
  // Lascia "" per processare tutti i messaggi recenti che sembrano lead.
  // Esempio: se i lead di Shoma arrivano con un'etichetta specifica, mettila qui.
  FILTER_LABEL: "",

  // Mittenti dei sistemi lead noti (whitelist parziale). Il match e' "contiene"
  KNOWN_SENDERS: [
    "shoma",          // gestionale Shoma
    "fitandgo",       // sistema interno
    "noreply@",       // notifiche automatiche generiche
    "info@",
    "lead",
    "contatto",
    "form",
  ],

  // Parole nell'oggetto che indicano sicuramente un lead
  SUBJECT_KEYWORDS: [
    "lead",
    "nuovo contatto",
    "nuova richiesta",
    "richiesta info",
    "prova gratuita",
    "form contatti",
    "ha richiesto",
  ],

  // Massimo numero di email da processare per esecuzione (evita rate limit)
  MAX_PER_RUN: 30,

  // Quanto indietro guardare (in giorni)
  DAYS_BACK: 7,
};

// ╔════════════════════════════════════════════════════════════════╗
// ║  ENTRY POINT — chiamato dal trigger ogni 5 minuti               ║
// ╚════════════════════════════════════════════════════════════════╝

function processaLead() {
  const label = getOrCreateLabel(CONFIG.PROCESSED_LABEL);

  // Costruisce la query di ricerca
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
        if (!lead) {
          scartati++;
          continue;
        }

        const ok = postToWebhook(lead);
        if (ok) {
          inviati++;
          thread.addLabel(label);
        } else {
          Logger.log("Errore POST per email " + msg.getId());
        }
      } catch (e) {
        Logger.log("Errore su messaggio " + msg.getId() + ": " + e.message);
      }
    }
  }

  Logger.log("Run completato: " + inviati + " inviati, " + scartati + " non-lead.");
}

// ╔════════════════════════════════════════════════════════════════╗
// ║  PARSER — estrae i dati lead dal corpo dell'email               ║
// ╚════════════════════════════════════════════════════════════════╝

function parseLeadFromMessage(msg) {
  const from = (msg.getFrom() || "").toLowerCase();
  const subject = (msg.getSubject() || "").toLowerCase();
  const body = msg.getPlainBody() || "";

  // 1. Filtro: l'email deve sembrare un lead
  const senderOk = CONFIG.KNOWN_SENDERS.some(s => from.indexOf(s) !== -1);
  const subjectOk = CONFIG.SUBJECT_KEYWORDS.some(s => subject.indexOf(s) !== -1);
  // Se proprio nessun match, scarta
  if (!senderOk && !subjectOk) return null;

  // 2. Estrae i campi
  const nome   = extractField(body, ["nome", "name", "first name"]);
  const cognome= extractField(body, ["cognome", "surname", "last name"]);
  const email  = extractEmail(body);
  const tel    = extractPhone(body);
  const fonte  = extractField(body, ["fonte", "provenienza", "come ci hai conosciuto", "source"]) || guessFonte(subject, from);
  const messaggio = extractField(body, ["messaggio", "message", "richiesta", "note"]);

  // Senza nome non possiamo creare il lead
  if (!nome && !email && !tel) return null;

  return {
    nome: nome || (email ? email.split("@")[0] : "Lead senza nome"),
    cognome: cognome,
    email: email,
    telefono: tel,
    fonte: fonte || "Gmail",
    campagna: extractField(body, ["campagna", "campaign"]),
    messaggio: messaggio,
    email_subject: msg.getSubject(),
    email_received_at: msg.getDate().toISOString(),
    email_id: msg.getId(),
  };
}

// Cerca nel corpo "<label>:<valore>" o "<label> <valore>" su righe separate
function extractField(body, labels) {
  const lines = body.split(/\r?\n/);
  for (var i = 0; i < labels.length; i++) {
    var label = labels[i].toLowerCase();
    // Pattern "<label>: valore" sulla stessa riga
    var re1 = new RegExp("^\\s*" + escapeRegex(label) + "\\s*[:\\-]\\s*(.+?)\\s*$", "im");
    for (var j = 0; j < lines.length; j++) {
      var m = lines[j].match(re1);
      if (m && m[1]) return cleanValue(m[1]);
    }
    // Pattern "<label>" su una riga e valore sulla riga successiva
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

function extractPhone(body) {
  // Cerca pattern italiani: +39 oppure 3xx xxxxxxx
  var patterns = [
    /\+39\s?\d{2,3}\s?\d{3}\s?\d{4}/,
    /\+\d{1,3}\s?\d{6,12}/,
    /\b3\d{2}\s?\d{3}\s?\d{4}\b/,
    /\b\d{10}\b/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = body.match(patterns[i]);
    if (m) return m[0].replace(/\s/g, "");
  }
  return null;
}

function guessFonte(subject, from) {
  if (subject.indexOf("instagram") !== -1 || from.indexOf("instagram") !== -1) return "Instagram";
  if (subject.indexOf("facebook")  !== -1 || from.indexOf("facebook")  !== -1) return "Facebook";
  if (subject.indexOf("sito")      !== -1) return "Sito web";
  if (subject.indexOf("shoma")     !== -1 || from.indexOf("shoma")     !== -1) return "Shoma";
  if (subject.indexOf("fit") !== -1 && subject.indexOf("go") !== -1) return "Fit & Go";
  return null;
}

function cleanValue(v) {
  return String(v || "").trim().replace(/^["']|["']$/g, "").substring(0, 500);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ╔════════════════════════════════════════════════════════════════╗
// ║  HTTP POST verso il webhook Vercel                              ║
// ╚════════════════════════════════════════════════════════════════╝

function postToWebhook(lead) {
  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "x-kendo-secret": CONFIG.SECRET },
    payload: JSON.stringify(lead),
    muteHttpExceptions: true,
  };
  try {
    var response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      Logger.log("✓ Lead inviato: " + (lead.nome || lead.email || lead.telefono));
      return true;
    }
    Logger.log("✗ HTTP " + code + ": " + response.getContentText());
    return false;
  } catch (e) {
    Logger.log("✗ Eccezione fetch: " + e.message);
    return false;
  }
}

// ╔════════════════════════════════════════════════════════════════╗
// ║  Util: crea label se non esiste                                 ║
// ╚════════════════════════════════════════════════════════════════╝

function getOrCreateLabel(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

// ╔════════════════════════════════════════════════════════════════╗
// ║  Funzione di test: esegui manualmente per verificare           ║
// ╚════════════════════════════════════════════════════════════════╝

function testConnessione() {
  var lead = {
    nome: "Mario",
    cognome: "Test",
    email: "test@example.com",
    telefono: "+393331234567",
    fonte: "TEST",
    messaggio: "Questo e' un lead di test dallo script Gmail.",
    email_subject: "TEST CONNESSIONE",
    email_received_at: new Date().toISOString(),
    email_id: "TEST_" + new Date().getTime(),
  };
  var ok = postToWebhook(lead);
  Logger.log(ok ? "✓ Connessione OK — lead di test inviato" : "✗ Connessione FALLITA — verifica WEBHOOK_URL e SECRET");
}
