/**
 * KENDO - Import automatico clienti da Gmail (file CSV)
 *
 * Cosa fa:
 *   - Ogni 30 min scansiona fitandgopadova@gmail.com
 *   - Cerca email NUOVE con oggetto "Export analisi clienti" + allegato CSV
 *   - Manda il contenuto del CSV al webhook /api/marketing-webhook
 *   - Etichetta l'email come "KendoMarketingProcessed" per non rielaborarla
 *
 * COME INSTALLARE (5 minuti):
 *   1. Vai su https://script.google.com (loggato con fitandgopadova@gmail.com)
 *   2. "Nuovo progetto"
 *   3. Cancella il codice di esempio e incolla TUTTO questo file
 *   4. Salva e dai un nome (es. "Kendo Import Clienti")
 *   5. Premi "Esegui" su importaClienti → autorizza l'accesso a Gmail
 *   6. Trigger (icona orologio a sinistra) → "+ Aggiungi trigger":
 *      - Funzione: importaClienti
 *      - Sorgente evento: Basato sul tempo → ogni 30 minuti
 *   7. Salva. Da ora gira da solo.
 *
 * NOTA: non serve abilitare nessun servizio extra (il file arriva già in CSV).
 */

const MKT_CONFIG = {
  WEBHOOK_URL: "https://kendo-app-weld.vercel.app/api/marketing-webhook",
  SECRET: "kendo-VxIPNeH0Ar1gbiOIdna4M9EWHhnqGyQd",
  PROCESSED_LABEL: "KendoMarketingProcessed",
  // Oggetto dell'email da cercare (match "contiene", case-insensitive)
  SUBJECT_MATCH: "export analisi clienti",
  // Solo questo negozio viene importato (lascia "" per importare tutti i negozi del file)
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
        // Accetta allegati CSV (o text/plain che contengono CSV)
        if (name.indexOf(".csv") !== -1 || type.indexOf("csv") !== -1 || type.indexOf("text/plain") !== -1) {
          csvText = att.getDataAsString("UTF-8");
          // Se i caratteri accentati sembrano corrotti, riprova con latin1
          if (csvText && csvText.indexOf("�") !== -1) {
            try { csvText = att.getDataAsString("ISO-8859-1"); } catch (e) {}
          }
          break;
        }
      }

      if (!csvText) {
        Logger.log("Nessun allegato CSV valido in: " + msg.getSubject());
        continue;
      }

      var ok = postCsvWebhook(csvText);
      if (ok) {
        thread.addLabel(label);
        processate++;
        Logger.log("✓ Import inviato per: " + msg.getSubject());
      } else {
        Logger.log("✗ Errore invio webhook per: " + msg.getSubject());
      }
    }
  }
  Logger.log("Run completato: " + processate + " file CSV importati.");
}

function postCsvWebhook(csvText) {
  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "x-kendo-secret": MKT_CONFIG.SECRET },
    payload: JSON.stringify({ csv: csvText, negozio: MKT_CONFIG.NEGOZIO }),
    muteHttpExceptions: true,
  };
  try {
    var response = UrlFetchApp.fetch(MKT_CONFIG.WEBHOOK_URL, options);
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      Logger.log("Webhook OK: " + response.getContentText());
      return true;
    }
    Logger.log("Webhook HTTP " + code + ": " + response.getContentText());
    return false;
  } catch (e) {
    Logger.log("Eccezione fetch: " + e.message);
    return false;
  }
}

function getOrCreateLabelMkt(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

// Funzione di test: esegui manualmente per verificare la connessione al webhook
function testMarketingWebhook() {
  var csvDemo = "Negozio;Nome;Surname;Email;Sms;Data_Nascita;Status CRM\n" +
                "FIT Padova;Mario;TestImport;mario.test@example.com;\"=\"\"+393331234567\"\"\";;CLIENTE ATTIVO";
  var ok = postCsvWebhook(csvDemo);
  Logger.log(ok ? "✓ Webhook raggiungibile" : "✗ Webhook NON raggiungibile - verifica URL e SECRET");
}
