// Modulo Pagamenti · sub-componenti per la gestione finanziaria
// - PagamentiCliente: cronologia + nuovo pagamento dentro la scheda cliente
// - ModalNuovoPagamento: form rapido di registrazione
// - PagamentiList (admin globale, opzionale): tutti i pagamenti recenti

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const K = {
  gold: "#D4A843", goldBg: "rgba(212,168,67,.12)",
  bg: "#0a0a0a", surface: "#141414",
  border: "#2a2a2a",
  white: "#e4e4e4", muted: "#8a8a8a", mutedLight: "#b0b0b0",
  green: "#10b981", red: "#dc2626", blue: "#3b82f6",
};

export function PagamentiCliente({ cliente, onChange }) {
  const [pag, setPag] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const carica = useCallback(async () => {
    if (!cliente?.id) return;
    const { data } = await sb.from("pagamento").select("*").eq("cliente_id", cliente.id).order("data", { ascending: false }).limit(20);
    setPag(data || []);
    setLoading(false);
  }, [cliente]);

  useEffect(() => { carica(); }, [carica]);

  const tot = pag.reduce((s, p) => s + (parseFloat(p.importo) || 0), 0);

  return (
    <div style={card({ marginBottom: 14 })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>PAGAMENTI</div>
        <div style={{ fontSize: 11, color: K.gold, fontWeight: 600 }}>Totale: €{tot.toFixed(2)}</div>
      </div>

      <button onClick={() => setModalOpen(true)} style={btn("gold", { width: "100%", padding: "10px", fontSize: 13, marginBottom: 10 })}>
        + Registra pagamento
      </button>

      {loading ? (
        <div style={{ fontSize: 12, color: K.muted, textAlign: "center", padding: 12 }}>Caricamento...</div>
      ) : pag.length === 0 ? (
        <div style={{ fontSize: 12, color: K.muted, textAlign: "center", padding: 12 }}>Nessun pagamento registrato</div>
      ) : (
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {pag.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${K.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: K.white, fontWeight: 500 }}>
                  €{parseFloat(p.importo).toFixed(2)} <span style={{ fontSize: 10, color: K.muted, marginLeft: 6 }}>{labMetodo(p.metodo)}</span>
                </div>
                <div style={{ fontSize: 11, color: K.muted, marginTop: 2 }}>
                  {labCausale(p.causale)}{p.descrizione ? ` · ${p.descrizione}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 11, color: K.mutedLight, textAlign: "right" }}>
                {new Date(p.data).toLocaleDateString("it-IT")}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ModalNuovoPagamento
          cliente={cliente}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); carica(); if (onChange) onChange(); }}
        />
      )}
    </div>
  );
}

function ModalNuovoPagamento({ cliente, onClose, onSaved }) {
  const [f, setF] = useState({
    importo: "",
    metodo: "bancomat",
    causale: "pacchetto",
    descrizione: "",
    data: new Date().toISOString().split("T")[0],
    aggiornaValoreCliente: true,
    scalaDebito: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const u = (k, v) => setF(p => ({ ...p, [k]: v }));

  const salva = async () => {
    setErr("");
    const importo = parseFloat(f.importo);
    if (!importo || importo <= 0) { setErr("Importo non valido"); return; }
    setSaving(true);
    try {
      const payload = {
        cliente_id: cliente.id,
        importo: importo,
        metodo: f.metodo,
        causale: f.causale,
        descrizione: f.descrizione || null,
        data: f.data,
        pacchetto_nome: f.causale === "pacchetto" ? (cliente.pacchetto || null) : null,
      };
      const { error } = await sb.from("pagamento").insert(payload);
      if (error) throw error;

      // Aggiorna valore_cliente e/o debito
      const patch = {};
      if (f.aggiornaValoreCliente) {
        patch.valore_cliente = (parseFloat(cliente.valore_cliente) || 0) + importo;
      }
      if (f.scalaDebito) {
        const nuovo = Math.max(0, (parseFloat(cliente.posizione_debitoria) || 0) - importo);
        patch.posizione_debitoria = nuovo;
      }
      if (Object.keys(patch).length) {
        await sb.from("clienti").update(patch).eq("id", cliente.id);
      }
      onSaved();
    } catch (e) {
      setErr("Errore: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={modalOverlay}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: K.gold, fontWeight: 600 }}>Registra pagamento</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: K.muted, fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ background: K.goldBg, border: `1px solid ${K.gold}55`, borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12 }}>
          <div style={{ color: K.gold, fontWeight: 600 }}>{cliente.nome} {cliente.cognome}</div>
          <div style={{ color: K.mutedLight, fontSize: 11, marginTop: 2 }}>Debito attuale: €{(parseFloat(cliente.posizione_debitoria) || 0).toFixed(2)}</div>
        </div>

        <label style={lbl}>Importo *</label>
        <input type="number" step="0.01" value={f.importo} onChange={e => u("importo", e.target.value)} placeholder="0,00" style={inp} autoFocus/>

        <label style={{ ...lbl, marginTop: 12 }}>Data</label>
        <input type="date" value={f.data} onChange={e => u("data", e.target.value)} style={inp}/>

        <label style={{ ...lbl, marginTop: 12 }}>Metodo di pagamento</label>
        <select value={f.metodo} onChange={e => u("metodo", e.target.value)} style={inp}>
          <option value="contanti">💵 Contanti</option>
          <option value="bancomat">💳 Bancomat</option>
          <option value="carta">💳 Carta di credito</option>
          <option value="bonifico">🏦 Bonifico</option>
          <option value="pagodil">📅 PagoDIL / APPAGO</option>
          <option value="assegno">📝 Assegno</option>
          <option value="altro">Altro</option>
        </select>

        <label style={{ ...lbl, marginTop: 12 }}>Causale</label>
        <select value={f.causale} onChange={e => u("causale", e.target.value)} style={inp}>
          <option value="pacchetto">📦 Pacchetto</option>
          <option value="iscrizione">🎫 Iscrizione annuale</option>
          <option value="integratore">💊 Integratore</option>
          <option value="abbigliamento">👕 Abbigliamento</option>
          <option value="altro">Altro</option>
        </select>

        <label style={{ ...lbl, marginTop: 12 }}>Descrizione (opzionale)</label>
        <input type="text" value={f.descrizione} onChange={e => u("descrizione", e.target.value)} placeholder="Es. Rinnovo Open 6 mesi" style={inp}/>

        <div style={{ marginTop: 14, padding: "10px 12px", background: K.bg, border: `1px solid ${K.border}`, borderRadius: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", color: K.white }}>
            <input type="checkbox" checked={f.aggiornaValoreCliente} onChange={e => u("aggiornaValoreCliente", e.target.checked)} style={{ accentColor: K.gold }}/>
            Somma all'LTV cliente
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", color: K.white, marginTop: 8 }}>
            <input type="checkbox" checked={f.scalaDebito} onChange={e => u("scalaDebito", e.target.checked)} style={{ accentColor: K.gold }}/>
            Scala dal debito attuale (€{(parseFloat(cliente.posizione_debitoria) || 0).toFixed(2)})
          </label>
        </div>

        {err && <div style={{ marginTop: 10, color: K.red, fontSize: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={btn("ghost", { flex: 1, padding: "10px 12px" })}>Annulla</button>
          <button onClick={salva} disabled={saving} style={btn("gold", { flex: 2, padding: "10px 12px", opacity: saving ? 0.5 : 1 })}>
            {saving ? "Salvataggio..." : "💰 Registra"}
          </button>
        </div>
      </div>
    </div>
  );
}

// === HELPERS ===
const labMetodo = (m) => ({ contanti: "Contanti", bancomat: "Bancomat", carta: "Carta", bonifico: "Bonifico", pagodil: "PagoDIL", assegno: "Assegno" })[m] || m || "—";
const labCausale = (c) => ({ pacchetto: "Pacchetto", iscrizione: "Iscrizione", integratore: "Integratore", abbigliamento: "Abbigliamento", altro: "Altro" })[c] || c || "—";

const card = (extra = {}) => ({ background: K.surface, border: `1px solid ${K.border}`, borderRadius: 12, padding: 16, ...extra });
const inp = { width: "100%", padding: "10px 12px", fontSize: 13, background: K.bg, border: `1px solid ${K.border}`, borderRadius: 8, color: K.white, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lbl = { fontSize: 11, color: K.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" };
const modalOverlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const modalBox = { background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14, padding: 20, maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.6)" };

function btn(kind, extra = {}) {
  const base = { border: "1px solid", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontFamily: "inherit", transition: "all .15s" };
  if (kind === "gold") return { ...base, background: K.gold, borderColor: K.gold, color: K.bg, ...extra };
  return { ...base, background: "transparent", borderColor: K.border, color: K.white, ...extra };
}
