// Import file "Marketing" (export clienti/lead da Shoma/gestionale Fit And Go).
// Drag&drop del CSV -> parsing -> match con clienti esistenti -> upsert.
// Rispetta lo status impostato manualmente (status_manuale=true non viene sovrascritto).

import { useState } from "react";
import { supabase } from "./supabaseClient";

const K = {
  gold: "#D4A843", goldBg: "#141008", goldBorder: "#2e2510",
  black: "#080808", card: "#111", border: "#1e1e1e", borderMid: "#2a2a2a",
  white: "#F5F5F5", muted: "#666", mutedLight: "#bbb",
  success: "#2a9d6f", successBg: "#081a12", successBorder: "#0f3020",
  danger: "#c0392b", dangerBg: "#160808", dangerBorder: "#2e1010",
  info: "#3a7bd5",
};

// ─── Parser CSV robusto (gestisce virgolette e separatore ;) ───
function parseCSV(text, sep = ";") {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === sep) { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Rimuove wrapper Excel ="..." dalle celle
function cleanCell(raw) {
  let v = (raw || "").trim();
  const m = v.match(/^=\s*"?(.*?)"?$/);
  if (m) v = m[1];
  v = v.replace(/^"+|"+$/g, "").replace(/""/g, '"').trim();
  return v;
}

// dd/mm/yyyy -> yyyy-mm-dd
function parseDate(s) {
  const m = (s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// "298,0000" -> 298 (decimale italiano)
function parseNum(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// Normalizza telefono italiano a sole cifre senza prefisso
function normPhone(t) {
  let s = (t || "").replace(/[^0-9+]/g, "").replace(/^\+/, "");
  if (s.startsWith("0039")) s = s.slice(4);
  if (s.startsWith("39") && s.length >= 11) s = s.slice(2);
  if (s.startsWith("0")) s = s.slice(1);
  return s;
}

// Mappa lo Status CRM Shoma -> status Kendo
function mapStatus(s) {
  const v = (s || "").toUpperCase();
  if (v.includes("ATTIVO")) return "CLIENTE ATTIVO";
  if (v.includes("STAND")) return "CLIENTE STAND BY";
  if (v === "EX" || v.includes("EX ")) return "FINE PERCORSO";
  if (v.includes("ESCLUSO") || v.includes("CANCELL")) return "CANCELLATO";
  return "CLIENTE ATTIVO";
}

export default function ImportMarketing() {
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState(null);
  const [soloNegozio, setSoloNegozio] = useState("FIT Padova");
  const [negoziDisponibili, setNegoziDisponibili] = useState([]);
  const [fileName, setFileName] = useState("");

  const onFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setReport(null);
    // Legge come testo (prova UTF-8, fallback latin1 per accenti)
    let text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length < 2) { alert("File vuoto o non valido"); return; }

    const header = parsed[0].map(h => cleanCell(h).toLowerCase());
    const idx = (name) => header.findIndex(h => h.includes(name));
    const cols = {
      negozio: idx("negozio"),
      nome: idx("nome"),
      cognome: header.findIndex(h => h.includes("surname") || h.includes("cognome")),
      email: idx("email"),
      sms: header.findIndex(h => h === "sms" || h.includes("sms") || h.includes("cellulare") || h.includes("telefono")),
      data_nascita: idx("data_nascita") >= 0 ? idx("data_nascita") : idx("nascita"),
      status: idx("status"),
      sesso: idx("sesso"),
      cap: idx("cap"),
      valore: idx("valore"),
      debito: idx("debitoria"),
      fonte: idx("conosciuto"),
      cert_medico: header.findIndex(h => h.includes("certificato")),
      scad_iscrizione: header.findIndex(h => h.includes("scadenza iscriz")),
      ultimo_appt: header.findIndex(h => h.includes("ultimo appt")),
      ultima_bia: header.findIndex(h => h.includes("ultima bia")),
      creato_da: header.findIndex(h => h.includes("creato da")),
    };

    const dataRows = parsed.slice(1).filter(r => r.length >= 3).map(r => ({
      negozio: cleanCell(r[cols.negozio]),
      nome: cleanCell(r[cols.nome]),
      cognome: cleanCell(r[cols.cognome]),
      email: cleanCell(r[cols.email]).toLowerCase() || null,
      telefono: cleanCell(r[cols.sms]) || null,
      data_nascita: parseDate(cleanCell(r[cols.data_nascita])),
      status_crm: mapStatus(cleanCell(r[cols.status])),
      sesso: cleanCell(r[cols.sesso]) || null,
      cap: cleanCell(r[cols.cap]) || null,
      valore_cliente: parseNum(cleanCell(r[cols.valore])),
      posizione_debitoria: parseNum(cleanCell(r[cols.debito])),
      origine: cleanCell(r[cols.fonte]) || null,
      scadenza_certificato_medico: parseDate(cleanCell(r[cols.cert_medico])),
      scadenza_iscrizione: parseDate(cleanCell(r[cols.scad_iscrizione])),
      ultimo_appt_data: parseDate(cleanCell(r[cols.ultimo_appt])),
      ultima_bia_data: parseDate(cleanCell(r[cols.ultima_bia])),
      shoma_creato_da: cleanCell(r[cols.creato_da]) || null,
    })).filter(r => r.nome || r.telefono || r.email);

    setRows(dataRows);

    // Negozi disponibili nel file
    const negozi = [...new Set(dataRows.map(r => r.negozio).filter(Boolean))];
    setNegoziDisponibili(negozi);
    if (negozi.length && !negozi.includes(soloNegozio)) {
      // se "FIT Padova" non c'è, prendi il primo
      const padova = negozi.find(n => n.toLowerCase().includes("padova"));
      setSoloNegozio(padova || negozi[0]);
    }

    setPreview({ totale: dataRows.length, negozi });
  };

  const esegui = async () => {
    setImporting(true);
    setReport(null);
    try {
      const filtrati = rows.filter(r => !soloNegozio || r.negozio === soloNegozio);

      // Carica i clienti esistenti per il match
      const { data: esistenti } = await supabase.from("clienti")
        .select("id, telefono, email, status_manuale");
      const byPhone = {}, byEmail = {};
      (esistenti || []).forEach(c => {
        const np = normPhone(c.telefono);
        if (np) byPhone[np] = c;
        if (c.email) byEmail[c.email.toLowerCase()] = c;
      });

      let aggiornati = 0, nuovi = 0, errori = 0;
      const now = new Date().toISOString();

      for (const r of filtrati) {
        const np = normPhone(r.telefono);
        const match = (np && byPhone[np]) || (r.email && byEmail[r.email]);

        // Campi da scrivere (sempre aggiornati)
        const base = {
          nome: r.nome || null,
          cognome: r.cognome || null,
          email: r.email,
          telefono: r.telefono,
          data_nascita: r.data_nascita,
          sesso: r.sesso,
          cap: r.cap,
          valore_cliente: r.valore_cliente,
          posizione_debitoria: r.posizione_debitoria,
          origine: r.origine,
          scadenza_certificato_medico: r.scadenza_certificato_medico,
          scadenza_iscrizione: r.scadenza_iscrizione,
          ultimo_appt_data: r.ultimo_appt_data,
          ultima_bia_data: r.ultima_bia_data,
          shoma_creato_da: r.shoma_creato_da,
          negozio: r.negozio,
          ultimo_import_at: now,
        };

        if (match) {
          // UPDATE: lo status NON viene toccato se l'admin l'ha impostato manualmente
          const patch = { ...base };
          if (!match.status_manuale) patch.status_crm = r.status_crm;
          const { error } = await supabase.from("clienti").update(patch).eq("id", match.id);
          if (error) errori++; else aggiornati++;
        } else {
          // INSERT nuovo cliente
          const { error } = await supabase.from("clienti").insert({
            ...base,
            status_crm: r.status_crm,
            status_manuale: false,
          });
          if (error) errori++; else nuovi++;
        }
      }

      setReport({ aggiornati, nuovi, errori, totale: filtrati.length });
    } catch (e) {
      alert("Errore import: " + e.message);
    }
    setImporting(false);
  };

  const C = (ex = {}) => ({ background: K.card, border: `1px solid ${K.border}`, borderRadius: 12, padding: 14, marginBottom: 10, ...ex });

  return (
    <div>
      <div style={{ fontSize: 12, color: K.mutedLight, marginBottom: 14, lineHeight: 1.6 }}>
        Carica il file <strong>Marketing</strong> esportato da Shoma (CSV). Il sistema aggiorna i clienti esistenti
        (anagrafica, scadenze, valore, BIA) e inserisce i nuovi. Lo status impostato a mano nel pannello NON viene sovrascritto.
      </div>

      {/* Upload */}
      <div style={C()}>
        <label style={{ display: "block", padding: "24px 12px", border: `2px dashed ${K.goldBorder}`, borderRadius: 8, textAlign: "center", cursor: "pointer", background: K.goldBg }}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>📋</div>
          <div style={{ fontSize: 13, color: K.gold, fontWeight: 600 }}>{fileName || "Trascina qui il file Marketing.csv o clicca"}</div>
          <div style={{ fontSize: 11, color: K.muted, marginTop: 4 }}>Formato CSV esportato da Shoma</div>
          <input type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files?.[0])} style={{ display: "none" }} />
        </label>
      </div>

      {/* Preview */}
      {preview && (
        <div style={C()}>
          <div style={{ fontSize: 13, fontWeight: 600, color: K.white, marginBottom: 10 }}>
            File letto: {preview.totale} righe totali
          </div>
          {negoziDisponibili.length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: K.muted, display: "block", marginBottom: 4 }}>Importa solo il negozio:</label>
              <select value={soloNegozio} onChange={e => setSoloNegozio(e.target.value)}
                style={{ width: "100%", background: "#111", border: `1px solid ${K.border}`, color: K.white, borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                <option value="">Tutti i negozi ({preview.totale})</option>
                {negoziDisponibili.map(n => {
                  const cnt = rows.filter(r => r.negozio === n).length;
                  return <option key={n} value={n}>{n} ({cnt})</option>;
                })}
              </select>
            </div>
          )}
          <div style={{ fontSize: 12, color: K.mutedLight, marginBottom: 12 }}>
            Verranno processate <strong style={{ color: K.gold }}>{rows.filter(r => !soloNegozio || r.negozio === soloNegozio).length}</strong> righe
            {soloNegozio ? ` (negozio "${soloNegozio}")` : " (tutti i negozi)"}.
          </div>
          <button onClick={esegui} disabled={importing} style={{ width: "100%", background: K.gold, color: "#080808", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 600, cursor: importing ? "wait" : "pointer", opacity: importing ? 0.6 : 1 }}>
            {importing ? "⏳ Import in corso..." : "🔄 Avvia importazione"}
          </button>
        </div>
      )}

      {/* Report */}
      {report && (
        <div style={C({ border: `1px solid ${K.successBorder}`, background: K.successBg })}>
          <div style={{ fontSize: 14, fontWeight: 600, color: K.success, marginBottom: 10 }}>✓ Importazione completata</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: K.gold }}>{report.aggiornati}</div>
              <div style={{ fontSize: 11, color: K.muted }}>aggiornati</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: K.success }}>{report.nuovi}</div>
              <div style={{ fontSize: 11, color: K.muted }}>nuovi</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: report.errori > 0 ? K.danger : K.muted }}>{report.errori}</div>
              <div style={{ fontSize: 11, color: K.muted }}>errori</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: K.mutedLight, marginTop: 12, textAlign: "center" }}>
            Ricarica la sezione Clienti per vedere i dati aggiornati.
          </div>
        </div>
      )}
    </div>
  );
}
