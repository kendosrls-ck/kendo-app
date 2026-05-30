// Magazzino · gestione prodotti (integratori, abbigliamento, accessori)
// - Lista con filtri e ricerca
// - Aggiunta/modifica/eliminazione prodotto
// - Movimenti (carico, scarico vendita, scarico uso, rettifica)
// - Alert scorte basse

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const K = {
  gold: "#D4A843", goldBg: "rgba(212,168,67,.12)",
  bg: "#0a0a0a", surface: "#141414", surfaceLight: "#1c1c1c",
  border: "#2a2a2a",
  white: "#e4e4e4", muted: "#8a8a8a", mutedLight: "#b0b0b0",
  green: "#10b981", red: "#dc2626", blue: "#3b82f6", purple: "#9B8FFF",
};

const CATEGORIE = [
  { k: "integratore", lab: "💊 Integratori" },
  { k: "abbigliamento", lab: "👕 Abbigliamento" },
  { k: "accessorio", lab: "🎽 Accessori" },
  { k: "altro", lab: "📦 Altro" },
];

export default function Magazzino() {
  const [prodotti, setProdotti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("tutti");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // { tipo: "nuovo"|"edit"|"movimento", prodotto? }

  const carica = async () => {
    setLoading(true);
    const { data } = await sb.from("prodotto").select("*").eq("attivo", true).order("nome");
    setProdotti(data || []);
    setLoading(false);
  };
  useEffect(() => { carica(); }, []);

  const filtered = useMemo(() => {
    let l = prodotti;
    if (filtro !== "tutti" && filtro !== "scorte_basse") l = l.filter(p => p.categoria === filtro);
    if (filtro === "scorte_basse") l = l.filter(p => p.giacenza <= (p.giacenza_minima || 5));
    if (search.trim()) {
      const s = search.toLowerCase();
      l = l.filter(p => (p.nome || "").toLowerCase().includes(s) || (p.codice || "").toLowerCase().includes(s));
    }
    return l;
  }, [prodotti, filtro, search]);

  const scorteBasse = prodotti.filter(p => p.giacenza <= (p.giacenza_minima || 5)).length;
  const valoreMagazzino = prodotti.reduce((s, p) => s + (parseFloat(p.prezzo_acquisto) || 0) * (p.giacenza || 0), 0);
  const valorePotenziale = prodotti.reduce((s, p) => s + (parseFloat(p.prezzo_vendita) || 0) * (p.giacenza || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Magazzino</div>
          <div style={{ fontSize: 12, color: K.muted, marginTop: 2 }}>
            {prodotti.length} prodotti · valore acquisto €{valoreMagazzino.toFixed(0)} · valore vendita €{valorePotenziale.toFixed(0)}
          </div>
        </div>
        <button onClick={() => setModal({ tipo: "nuovo" })} style={btn("gold", { padding: "8px 14px", fontSize: 12 })}>+ Nuovo prodotto</button>
      </div>

      {/* ALERT SCORTE */}
      {scorteBasse > 0 && (
        <div onClick={() => setFiltro("scorte_basse")} style={{ cursor: "pointer", background: "#7f1d1d22", border: `1px solid ${K.red}55`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: K.red, fontSize: 13, fontWeight: 600 }}>
          ⚠ {scorteBasse} prodott{scorteBasse > 1 ? "i" : "o"} sotto la soglia minima — clicca per filtrare
        </div>
      )}

      {/* SEARCH */}
      <input type="text" placeholder="Cerca per nome o codice..." value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", fontSize: 13, background: K.surface, border: `1px solid ${K.border}`, borderRadius: 8, color: K.white, outline: "none", marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" }} />

      {/* FILTRI */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {[["tutti", "Tutti"], ...CATEGORIE.map(c => [c.k, c.lab]), ["scorte_basse", "⚠ Scorte basse"]].map(([k, lab]) => (
          <button key={k} onClick={() => setFiltro(k)} style={{
            flexShrink: 0,
            background: filtro === k ? K.goldBg : "transparent",
            border: `1px solid ${filtro === k ? K.gold : K.border}`,
            color: filtro === k ? K.gold : K.mutedLight,
            borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap"
          }}>{lab}</button>
        ))}
      </div>

      {/* LISTA */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "2rem", color: K.muted, fontSize: 13 }}>Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: K.muted, fontSize: 13, background: K.surface, border: `1px solid ${K.border}`, borderRadius: 12 }}>
          {prodotti.length === 0 ? "Nessun prodotto in magazzino. Aggiungi il primo!" : "Nessun risultato per i filtri scelti."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {filtered.map(p => {
            const margine = (parseFloat(p.prezzo_vendita) || 0) - (parseFloat(p.prezzo_acquisto) || 0);
            const basso = p.giacenza <= (p.giacenza_minima || 5);
            const esaurito = p.giacenza <= 0;
            return (
              <div key={p.id} style={{ background: K.surface, border: `1px solid ${esaurito ? K.red : basso ? "#f59e0b" : K.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: K.white, marginBottom: 2 }}>{p.nome}</div>
                    <div style={{ fontSize: 10, color: K.muted }}>{labCat(p.categoria)}{p.codice ? ` · ${p.codice}` : ""}</div>
                  </div>
                  <button onClick={() => setModal({ tipo: "edit", prodotto: p })} style={{ background: "none", border: "none", color: K.muted, cursor: "pointer", fontSize: 14 }}>✏</button>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0", padding: "10px 0", borderTop: `1px solid ${K.border}`, borderBottom: `1px solid ${K.border}` }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: esaurito ? K.red : basso ? "#f59e0b" : K.gold, lineHeight: 1 }}>{p.giacenza}</div>
                    <div style={{ fontSize: 10, color: K.muted, marginTop: 2 }}>in giacenza</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: K.green }}>€{parseFloat(p.prezzo_vendita || 0).toFixed(2)}</div>
                    {p.prezzo_acquisto > 0 && <div style={{ fontSize: 10, color: K.muted }}>margine €{margine.toFixed(2)}</div>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setModal({ tipo: "movimento", prodotto: p, mode: "scarico_vendita" })} disabled={esaurito} style={btn("gold", { flex: 2, padding: "8px", fontSize: 12, opacity: esaurito ? 0.4 : 1 })}>
                    💰 Vendi
                  </button>
                  <button onClick={() => setModal({ tipo: "movimento", prodotto: p, mode: "carico" })} style={btn("ghost", { flex: 1, padding: "8px", fontSize: 12 })}>
                    + Carico
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.tipo === "nuovo" && <ModalProdotto onClose={() => setModal(null)} onSaved={() => { setModal(null); carica(); }} />}
      {modal?.tipo === "edit" && <ModalProdotto prodotto={modal.prodotto} onClose={() => setModal(null)} onSaved={() => { setModal(null); carica(); }} />}
      {modal?.tipo === "movimento" && <ModalMovimento prodotto={modal.prodotto} modeIniziale={modal.mode} onClose={() => setModal(null)} onSaved={() => { setModal(null); carica(); }} />}
    </div>
  );
}

function ModalProdotto({ prodotto, onClose, onSaved }) {
  const edit = !!prodotto;
  const [f, setF] = useState({
    codice: prodotto?.codice || "",
    nome: prodotto?.nome || "",
    categoria: prodotto?.categoria || "integratore",
    descrizione: prodotto?.descrizione || "",
    prezzo_vendita: prodotto?.prezzo_vendita || "",
    prezzo_acquisto: prodotto?.prezzo_acquisto || "",
    giacenza_iniziale: prodotto ? (prodotto.giacenza || 0) : "",
    giacenza_minima: prodotto?.giacenza_minima || 5,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const u = (k, v) => setF(p => ({ ...p, [k]: v }));

  const salva = async () => {
    setErr("");
    if (!f.nome.trim()) { setErr("Nome obbligatorio"); return; }
    setSaving(true);
    try {
      if (edit) {
        await sb.from("prodotto").update({
          codice: f.codice || null, nome: f.nome, categoria: f.categoria, descrizione: f.descrizione || null,
          prezzo_vendita: parseFloat(f.prezzo_vendita) || 0, prezzo_acquisto: parseFloat(f.prezzo_acquisto) || 0,
          giacenza_minima: parseInt(f.giacenza_minima) || 5, updated_at: new Date().toISOString(),
        }).eq("id", prodotto.id);
      } else {
        const giac = parseInt(f.giacenza_iniziale) || 0;
        const { data: ins } = await sb.from("prodotto").insert({
          codice: f.codice || null, nome: f.nome, categoria: f.categoria, descrizione: f.descrizione || null,
          prezzo_vendita: parseFloat(f.prezzo_vendita) || 0, prezzo_acquisto: parseFloat(f.prezzo_acquisto) || 0,
          giacenza: 0, giacenza_minima: parseInt(f.giacenza_minima) || 5,
        }).select().maybeSingle();
        // Crea movimento iniziale (così la giacenza si aggiorna via trigger)
        if (ins && giac > 0) {
          await sb.from("movimento_magazzino").insert({ prodotto_id: ins.id, tipo: "carico", quantita: giac, note: "Carico iniziale" });
        }
      }
      onSaved();
    } catch (e) {
      setErr("Errore: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const elimina = async () => {
    if (!window.confirm(`Eliminare definitivamente "${prodotto.nome}"? Verrà disattivato (storico movimenti conservato).`)) return;
    setSaving(true);
    await sb.from("prodotto").update({ attivo: false }).eq("id", prodotto.id);
    setSaving(false);
    onSaved();
  };

  return (
    <div onClick={onClose} style={modalOverlay}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: K.gold, fontWeight: 600 }}>{edit ? "Modifica prodotto" : "Nuovo prodotto"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: K.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
          <div><label style={lbl}>Nome *</label><input value={f.nome} onChange={e => u("nome", e.target.value)} placeholder="Es. Whey Protein Vanilla 2kg" style={inp} autoFocus/></div>
          <div><label style={lbl}>Codice</label><input value={f.codice} onChange={e => u("codice", e.target.value.toUpperCase())} placeholder="WHEY-VAN-2K" style={{ ...inp, fontFamily: "monospace" }}/></div>
        </div>

        <label style={{ ...lbl, marginTop: 10 }}>Categoria</label>
        <select value={f.categoria} onChange={e => u("categoria", e.target.value)} style={inp}>
          {CATEGORIE.map(c => <option key={c.k} value={c.k}>{c.lab}</option>)}
        </select>

        <label style={{ ...lbl, marginTop: 10 }}>Descrizione</label>
        <textarea value={f.descrizione} onChange={e => u("descrizione", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} placeholder="Caratteristiche, ingredienti, ecc."/>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          <div><label style={lbl}>Prezzo acquisto €</label><input type="number" step="0.01" value={f.prezzo_acquisto} onChange={e => u("prezzo_acquisto", e.target.value)} placeholder="0,00" style={inp}/></div>
          <div><label style={lbl}>Prezzo vendita €</label><input type="number" step="0.01" value={f.prezzo_vendita} onChange={e => u("prezzo_vendita", e.target.value)} placeholder="0,00" style={inp}/></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: edit ? "1fr" : "1fr 1fr", gap: 8, marginTop: 10 }}>
          {!edit && <div><label style={lbl}>Giacenza iniziale</label><input type="number" value={f.giacenza_iniziale} onChange={e => u("giacenza_iniziale", e.target.value)} placeholder="0" style={inp}/></div>}
          <div><label style={lbl}>Scorta minima (alert)</label><input type="number" value={f.giacenza_minima} onChange={e => u("giacenza_minima", e.target.value)} placeholder="5" style={inp}/></div>
        </div>

        {err && <div style={{ marginTop: 10, color: K.red, fontSize: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {edit && <button onClick={elimina} disabled={saving} style={btn("ghost", { padding: "10px 12px", color: K.red, borderColor: K.red + "55" })}>🗑</button>}
          <button onClick={onClose} style={btn("ghost", { flex: 1, padding: "10px 12px" })}>Annulla</button>
          <button onClick={salva} disabled={saving} style={btn("gold", { flex: 2, padding: "10px 12px", opacity: saving ? 0.5 : 1 })}>{saving ? "Salvataggio..." : "Salva"}</button>
        </div>
      </div>
    </div>
  );
}

function ModalMovimento({ prodotto, modeIniziale, onClose, onSaved }) {
  const [tipo, setTipo] = useState(modeIniziale || "scarico_vendita");
  const [qty, setQty] = useState(1);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienti, setClienti] = useState([]);
  const [cliSel, setCliSel] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [registraPagamento, setRegistraPagamento] = useState(true);
  const [metodoPag, setMetodoPag] = useState("bancomat");

  useEffect(() => {
    if (tipo === "scarico_vendita") {
      sb.from("clienti").select("id,nome,cognome,email,telefono").order("cognome").then(({ data }) => setClienti(data || []));
    }
  }, [tipo]);

  const filtClienti = useMemo(() => {
    if (!clienteSearch.trim() || clienteSearch.trim().length < 1) return [];
    const tokens = clienteSearch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean);
    return clienti.filter(c => {
      const hay = `${(c.nome || "").toLowerCase()} ${(c.cognome || "").toLowerCase()} ${(c.email || "").toLowerCase()}`;
      return tokens.every(t => hay.includes(t));
    }).slice(0, 6);
  }, [clienteSearch, clienti]);

  const totale = qty * parseFloat(prodotto.prezzo_vendita || 0);

  const salva = async () => {
    setErr("");
    if (qty < 1) { setErr("Quantità minima 1"); return; }
    if (tipo === "scarico_vendita" && !cliSel) { setErr("Seleziona il cliente che ha acquistato"); return; }
    if (tipo !== "carico" && qty > prodotto.giacenza) { setErr(`Giacenza insufficiente (disponibili ${prodotto.giacenza})`); return; }
    setSaving(true);
    try {
      let pagamentoId = null;
      if (tipo === "scarico_vendita" && registraPagamento) {
        const { data: pag } = await sb.from("pagamento").insert({
          cliente_id: cliSel.id,
          importo: totale,
          metodo: metodoPag,
          causale: prodotto.categoria === "integratore" ? "integratore" : prodotto.categoria === "abbigliamento" ? "abbigliamento" : "altro",
          descrizione: `${qty}x ${prodotto.nome}`,
        }).select().maybeSingle();
        pagamentoId = pag?.id;
        // Aggiorna LTV
        await sb.from("clienti").update({ valore_cliente: (parseFloat(cliSel.valore_cliente) || 0) + totale }).eq("id", cliSel.id);
      }
      await sb.from("movimento_magazzino").insert({
        prodotto_id: prodotto.id,
        tipo, quantita: qty,
        cliente_id: cliSel?.id || null,
        pagamento_id: pagamentoId,
        note: note || null,
      });
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
          <h3 style={{ margin: 0, fontSize: 16, color: K.gold, fontWeight: 600 }}>Movimento magazzino</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: K.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ background: K.bg, border: `1px solid ${K.border}`, borderRadius: 8, padding: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: K.white }}>{prodotto.nome}</div>
          <div style={{ fontSize: 11, color: K.muted, marginTop: 2 }}>Giacenza attuale: <strong style={{ color: K.gold }}>{prodotto.giacenza}</strong> · Prezzo: €{parseFloat(prodotto.prezzo_vendita || 0).toFixed(2)}</div>
        </div>

        <label style={lbl}>Tipo movimento</label>
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={inp}>
          <option value="scarico_vendita">💰 Vendita a cliente</option>
          <option value="carico">+ Carico (entrata merce)</option>
          <option value="scarico_uso">Scarico per uso interno</option>
          <option value="scarico_perso">Scarico per perdita/scadenza</option>
          <option value="rettifica">Rettifica giacenza (positiva)</option>
        </select>

        <label style={{ ...lbl, marginTop: 10 }}>Quantità</label>
        <input type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} style={inp}/>

        {tipo === "scarico_vendita" && (
          <>
            <label style={{ ...lbl, marginTop: 10 }}>Cliente *</label>
            {!cliSel ? (
              <>
                <input value={clienteSearch} onChange={e => setClienteSearch(e.target.value)} placeholder="Cerca cliente..." style={inp}/>
                {filtClienti.length > 0 && (
                  <div style={{ background: K.bg, border: `1px solid ${K.border}`, borderRadius: 6, marginTop: 4, maxHeight: 160, overflowY: "auto" }}>
                    {filtClienti.map(c => (
                      <div key={c.id} onClick={() => { setCliSel(c); setClienteSearch(""); }} style={{ padding: "8px 10px", borderBottom: `1px solid ${K.border}`, cursor: "pointer", fontSize: 13, color: K.white }}>
                        {c.cognome} {c.nome}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ background: K.bg, border: `1px solid ${K.border}`, borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, color: K.white, fontWeight: 600 }}>{cliSel.cognome} {cliSel.nome}</div>
                <button onClick={() => setCliSel(null)} style={btn("ghost", { padding: "4px 10px", fontSize: 11 })}>cambia</button>
              </div>
            )}

            <div style={{ marginTop: 14, padding: 12, background: K.goldBg, border: `1px solid ${K.gold}55`, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: K.white }}>Totale vendita</span>
                <strong style={{ color: K.gold, fontSize: 18 }}>€{totale.toFixed(2)}</strong>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 10, color: K.white, cursor: "pointer" }}>
                <input type="checkbox" checked={registraPagamento} onChange={e => setRegistraPagamento(e.target.checked)} style={{ accentColor: K.gold }}/>
                Registra automaticamente il pagamento
              </label>
              {registraPagamento && (
                <select value={metodoPag} onChange={e => setMetodoPag(e.target.value)} style={{ ...inp, marginTop: 8 }}>
                  <option value="contanti">💵 Contanti</option>
                  <option value="bancomat">💳 Bancomat</option>
                  <option value="carta">💳 Carta</option>
                </select>
              )}
            </div>
          </>
        )}

        <label style={{ ...lbl, marginTop: 10 }}>Note</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Opzionale" style={inp}/>

        {err && <div style={{ marginTop: 10, color: K.red, fontSize: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={btn("ghost", { flex: 1, padding: "10px 12px" })}>Annulla</button>
          <button onClick={salva} disabled={saving} style={btn("gold", { flex: 2, padding: "10px 12px", opacity: saving ? 0.5 : 1 })}>
            {saving ? "Salvataggio..." : tipo === "scarico_vendita" ? "💰 Conferma vendita" : "Conferma"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labCat = (c) => CATEGORIE.find(x => x.k === c)?.lab || c;

const inp = { width: "100%", padding: "10px 12px", fontSize: 13, background: K.bg, border: `1px solid ${K.border}`, borderRadius: 8, color: K.white, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lbl = { fontSize: 11, color: K.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" };
const modalOverlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const modalBox = { background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14, padding: 20, maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.6)" };

function btn(kind, extra = {}) {
  const base = { border: "1px solid", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontFamily: "inherit", transition: "all .15s" };
  if (kind === "gold") return { ...base, background: K.gold, borderColor: K.gold, color: K.bg, ...extra };
  return { ...base, background: "transparent", borderColor: K.border, color: K.white, ...extra };
}
