// Planner Kendo · vista giornaliera multi-risorsa
// - 4 colonne: EMS, Vacufit 1, Vacufit 2, Nutrizionista
// - Slot da 30 min secondo gli orari di disponibilità di ciascuna risorsa
// - Click slot vuoto = nuova prenotazione (cerca cliente o crea inline)
// - Click prenotazione = dettaglio + cancella
// - Conferma automatica via /api/prenotazione-conferma (email + .ics)

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const K = {
  gold: "#D4A843", goldBg: "rgba(212,168,67,.12)",
  bg: "#0a0a0a", surface: "#141414", surfaceLight: "#1c1c1c",
  border: "#2a2a2a", borderLight: "#3a3a3a",
  text: "#e4e4e4", muted: "#8a8a8a", mutedLight: "#b0b0b0",
  green: "#10b981", red: "#dc2626", blue: "#3b82f6",
};

const SLOT_MIN = 30; // granularità della griglia

export default function Planner() {
  const [risorse, setRisorse] = useState([]);
  const [orari, setOrari] = useState([]);
  const [appuntamenti, setAppuntamenti] = useState([]);
  const [clienti, setClienti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [giorno, setGiorno] = useState(() => new Date().toISOString().split("T")[0]);
  const [modalNew, setModalNew] = useState(null); // { risorsa_id, ora_inizio }
  const [modalDetail, setModalDetail] = useState(null); // appuntamento
  const [oraAdesso, setOraAdesso] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  // Aggiorna ora corrente ogni 60 secondi
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setOraAdesso(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(t);
  }, []);

  // Carica risorse + clienti una volta
  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: o }, { data: c }] = await Promise.all([
        sb.from("risorsa").select("*").eq("attiva", true).order("ordine"),
        sb.from("risorsa_orario").select("*"),
        sb.from("clienti").select("id,nome,cognome,email,cellulare").order("cognome"),
      ]);
      setRisorse(r || []);
      setOrari(o || []);
      setClienti(c || []);
    })();
  }, []);

  // Carica appuntamenti del giorno
  const loadGiorno = useCallback(async () => {
    setLoading(true);
    const { data } = await sb
      .from("appuntamento")
      .select("*")
      .eq("data", giorno)
      .neq("stato", "cancellato")
      .order("ora_inizio");
    setAppuntamenti(data || []);
    setLoading(false);
  }, [giorno]);

  useEffect(() => { loadGiorno(); }, [loadGiorno]);

  const giornoDate = new Date(giorno + "T00:00:00");
  const giornoSet = ((giornoDate.getDay() + 6) % 7) + 1; // 1=lun..7=dom
  const labelGiorno = giornoDate.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isOggi = giorno === new Date().toISOString().split("T")[0];

  const cambiaGiorno = (delta) => {
    const d = new Date(giorno + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setGiorno(d.toISOString().split("T")[0]);
  };
  const cambiaMese = (delta) => {
    const d = new Date(giorno + "T00:00:00");
    d.setMonth(d.getMonth() + delta);
    setGiorno(d.toISOString().split("T")[0]);
  };
  const oggi = () => setGiorno(new Date().toISOString().split("T")[0]);

  // Limiti navigazione: ±1 anno da oggi
  const oggiDate = new Date();
  const minDate = new Date(oggiDate.getFullYear() - 1, oggiDate.getMonth(), oggiDate.getDate()).toISOString().split("T")[0];
  const maxDate = new Date(oggiDate.getFullYear() + 1, oggiDate.getMonth(), oggiDate.getDate()).toISOString().split("T")[0];

  // Orari aperti del giorno per ogni risorsa
  const orariRisorsa = (rId) => orari.filter(o => o.risorsa_id === rId && o.giorno_settimana === giornoSet);

  // Calcola range orario complessivo della giornata (min, max tra tutte le risorse)
  const { oraMin, oraMax } = useMemo(() => {
    const ranges = orari.filter(o => o.giorno_settimana === giornoSet);
    if (!ranges.length) return { oraMin: 7 * 60, oraMax: 22 * 60 };
    const min = Math.min(...ranges.map(o => toMin(o.ora_inizio)));
    const max = Math.max(...ranges.map(o => toMin(o.ora_fine)));
    return { oraMin: min, oraMax: max };
  }, [orari, giornoSet]);

  const slots = useMemo(() => {
    const s = [];
    for (let m = oraMin; m < oraMax; m += SLOT_MIN) s.push(m);
    return s;
  }, [oraMin, oraMax]);

  // Verifica se uno slot è dentro un orario disponibile per la risorsa
  const slotAperto = (rId, minuti) => {
    const ranges = orariRisorsa(rId);
    return ranges.some(o => minuti >= toMin(o.ora_inizio) && minuti < toMin(o.ora_fine));
  };

  // Appuntamento in uno slot specifico
  const appInSlot = (rId, minuti) => {
    return appuntamenti.find(a =>
      a.risorsa_id === rId &&
      toMin(a.ora_inizio) <= minuti &&
      toMin(a.ora_fine) > minuti
    );
  };

  // Inizio appuntamento (per renderizzarlo solo una volta nella prima cella)
  const appInizia = (rId, minuti) => appuntamenti.find(a => a.risorsa_id === rId && toMin(a.ora_inizio) === minuti);

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Planner</div>
          <div style={{ fontSize: 12, color: K.muted, marginTop: 2 }}>{appuntamenti.length} appuntamenti il {labelGiorno}</div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => cambiaMese(-1)} title="Mese precedente" style={btn("ghost", { padding: "6px 10px", fontSize: 11 })}>«</button>
          <button onClick={() => cambiaGiorno(-7)} title="Settimana precedente" style={btn("ghost", { padding: "6px 10px", fontSize: 11 })}>‹‹</button>
          <button onClick={() => cambiaGiorno(-1)} title="Giorno precedente" style={btn("ghost", { padding: "6px 12px" })}>◀</button>
          <button onClick={oggi} style={btn(isOggi ? "primary" : "ghost", { padding: "6px 14px", fontSize: 12 })}>Oggi</button>
          <input type="date" value={giorno} min={minDate} max={maxDate} onChange={e => setGiorno(e.target.value)} style={{ background: K.surface, border: `1px solid ${K.border}`, color: K.text, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
          <button onClick={() => cambiaGiorno(1)} title="Giorno successivo" style={btn("ghost", { padding: "6px 12px" })}>▶</button>
          <button onClick={() => cambiaGiorno(7)} title="Settimana successiva" style={btn("ghost", { padding: "6px 10px", fontSize: 11 })}>››</button>
          <button onClick={() => cambiaMese(1)} title="Mese successivo" style={btn("ghost", { padding: "6px 10px", fontSize: 11 })}>»</button>
        </div>
      </div>

      {/* GRIGLIA */}
      <div style={{ background: K.surface, border: `1px solid ${K.border}`, borderRadius: 12, overflow: "hidden" }}>
        {/* Intestazione risorse */}
        <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${risorse.length}, 1fr)`, borderBottom: `1px solid ${K.border}`, background: K.surfaceLight }}>
          <div style={{ padding: "10px 6px", fontSize: 10, color: K.muted, textAlign: "center" }}>Ora</div>
          {risorse.map(r => (
            <div key={r.id} style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: K.gold, textAlign: "center", borderLeft: `1px solid ${K.border}` }}>
              {r.nome}
            </div>
          ))}
        </div>

        {/* Righe slot */}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: K.muted, fontSize: 13 }}>Caricamento...</div>
        ) : (
          <div style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto", position: "relative" }}>
            {/* BARRA TEMPO CORRENTE (solo se stiamo guardando oggi e ora è nel range visibile) */}
            {isOggi && oraAdesso >= oraMin && oraAdesso < oraMax && (
              <div style={{
                position: "absolute",
                left: 0, right: 0,
                top: `${((oraAdesso - oraMin) / SLOT_MIN) * 36}px`,
                height: 2,
                background: "#ef4444",
                zIndex: 5,
                pointerEvents: "none",
                boxShadow: "0 0 6px rgba(239,68,68,.6)",
              }}>
                <div style={{
                  position: "absolute", left: 0, top: -6,
                  width: 10, height: 10, borderRadius: "50%",
                  background: "#ef4444",
                  boxShadow: "0 0 0 2px rgba(239,68,68,.3)",
                }} />
                <div style={{
                  position: "absolute", left: 14, top: -8,
                  fontSize: 10, color: "#ef4444", fontWeight: 700,
                  fontFamily: "monospace", background: K.surface, padding: "1px 5px",
                  borderRadius: 4, border: "1px solid #ef4444",
                }}>
                  {fromMin(oraAdesso)}
                </div>
              </div>
            )}
            {slots.map(minuti => (
              <div key={minuti} style={{ display: "grid", gridTemplateColumns: `60px repeat(${risorse.length}, 1fr)`, borderBottom: `1px solid ${K.border}`, minHeight: 36 }}>
                <div style={{ padding: "8px 6px", fontSize: 10, color: K.muted, textAlign: "center", fontFamily: "monospace" }}>{fromMin(minuti)}</div>
                {risorse.map(r => {
                  const aperto = slotAperto(r.id, minuti);
                  const inSlot = appInSlot(r.id, minuti);
                  const inizia = appInizia(r.id, minuti);
                  if (!aperto) {
                    return <div key={r.id} style={{ borderLeft: `1px solid ${K.border}`, background: "#0a0a0a" }} />;
                  }
                  if (inizia) {
                    const durMin = toMin(inizia.ora_fine) - toMin(inizia.ora_inizio);
                    const slotsOccupati = Math.max(1, Math.round(durMin / SLOT_MIN));
                    return (
                      <div key={r.id} onClick={() => setModalDetail(inizia)} style={{
                        borderLeft: `1px solid ${K.border}`,
                        background: `linear-gradient(135deg, ${r.colore || K.gold}33, ${r.colore || K.gold}22)`,
                        borderTop: `2px solid ${r.colore || K.gold}`,
                        padding: "4px 6px",
                        cursor: "pointer",
                        gridRow: `span ${slotsOccupati}`,
                        position: "relative",
                        zIndex: 2,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: K.text, lineHeight: 1.2 }}>
                          {inizia.cliente_nome} {inizia.cliente_cognome}
                        </div>
                        <div style={{ fontSize: 9, color: K.mutedLight, marginTop: 2 }}>
                          {inizia.ora_inizio?.slice(0, 5)}-{inizia.ora_fine?.slice(0, 5)}
                        </div>
                        {inizia.tipo_seduta && <div style={{ fontSize: 9, color: K.mutedLight }}>{inizia.tipo_seduta}</div>}
                      </div>
                    );
                  }
                  if (inSlot) return <div key={r.id} style={{ borderLeft: `1px solid ${K.border}` }} />; // cella occupata da app esteso
                  return (
                    <div key={r.id}
                      onClick={() => setModalNew({ risorsa_id: r.id, risorsa_nome: r.nome, durata_min: r.durata_default_min, ora_inizio: fromMin(minuti), data: giorno })}
                      style={{ borderLeft: `1px solid ${K.border}`, cursor: "pointer", transition: "background .15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = K.goldBg}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {modalNew && (
        <ModalNuovo
          slot={modalNew}
          clienti={clienti}
          onClose={() => setModalNew(null)}
          onSaved={() => { setModalNew(null); loadGiorno(); }}
        />
      )}
      {modalDetail && (
        <ModalDettaglio
          app={modalDetail}
          onClose={() => setModalDetail(null)}
          onChanged={() => { setModalDetail(null); loadGiorno(); }}
        />
      )}
    </div>
  );
}

// ====== MODAL NUOVA PRENOTAZIONE ======

function ModalNuovo({ slot, clienti, onClose, onSaved }) {
  const [cliente, setCliente] = useState(null);
  const [search, setSearch] = useState("");
  const [tipoSeduta, setTipoSeduta] = useState(suggerisciTipo(slot.risorsa_nome));
  const [durata, setDurata] = useState(slot.durata_min || 30);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [creaNuovo, setCreaNuovo] = useState(false);
  const [nuovoCli, setNuovoCli] = useState({ nome: "", cognome: "", email: "", telefono: "" });

  const filtered = useMemo(() => {
    if (!search || search.trim().length < 1) return [];
    const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const tokens = norm(search).split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return clienti.filter(c => {
      const haystack = `${norm(c.nome)} ${norm(c.cognome)} ${norm(c.email)} ${(c.cellulare || "").replace(/\D/g, "")}`;
      // Tutti i token devono apparire nel campo concatenato (AND)
      return tokens.every(t => haystack.includes(t));
    }).slice(0, 8);
  }, [search, clienti]);

  const oraFineCalc = useMemo(() => fromMin(toMin(slot.ora_inizio) + Number(durata || 30)), [slot.ora_inizio, durata]);

  const salva = async () => {
    setErr("");
    if (!cliente && !creaNuovo) { setErr("Seleziona un cliente o crea uno nuovo"); return; }
    if (creaNuovo && (!nuovoCli.nome.trim() || !nuovoCli.cognome.trim())) { setErr("Nome e cognome obbligatori"); return; }
    setSaving(true);
    try {
      const dati = {
        risorsa_id: slot.risorsa_id,
        data: slot.data,
        ora_inizio: slot.ora_inizio,
        ora_fine: oraFineCalc,
        tipo_seduta: tipoSeduta,
        stato: "confermato",
        note,
      };
      if (cliente) {
        Object.assign(dati, {
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          cliente_cognome: cliente.cognome,
          cliente_email: cliente.email,
          cliente_telefono: cliente.cellulare,
        });
      } else {
        Object.assign(dati, {
          cliente_nome: nuovoCli.nome,
          cliente_cognome: nuovoCli.cognome,
          cliente_email: nuovoCli.email,
          cliente_telefono: nuovoCli.telefono,
        });
      }
      const { data: ins, error } = await sb.from("appuntamento").insert(dati).select().maybeSingle();
      if (error) throw error;

      // Invia conferma email (non blocca se fallisce)
      if (ins?.id) {
        fetch("/api/prenotazione-conferma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appuntamento_id: ins.id }),
        }).catch(e => console.warn("conferma email fallita:", e));
      }

      onSaved();
    } catch (e) {
      setErr("Errore: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} titolo="Nuova prenotazione">
      <Riepilogo slot={slot} oraFine={oraFineCalc} />

      {/* CLIENTE */}
      <div style={lblBlock}>Cliente *</div>
      {!cliente && !creaNuovo && (
        <>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome, cognome o numero..."
            style={inp}
            autoFocus
          />
          {filtered.length > 0 && (
            <div style={{ background: K.bg, border: `1px solid ${K.border}`, borderRadius: 6, marginTop: 6, maxHeight: 200, overflowY: "auto" }}>
              {filtered.map(c => (
                <div key={c.id} onClick={() => { setCliente(c); setSearch(""); }} style={{ padding: "8px 10px", borderBottom: `1px solid ${K.border}`, cursor: "pointer", fontSize: 13 }}>
                  <div style={{ color: K.text, fontWeight: 600 }}>{c.cognome} {c.nome}</div>
                  <div style={{ color: K.muted, fontSize: 11 }}>{c.cellulare || "—"} · {c.email || "—"}</div>
                </div>
              ))}
            </div>
          )}
          {search.trim().length >= 1 && filtered.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: K.muted }}>Nessun cliente trovato con "{search}". Verifica l'ortografia o crea uno nuovo.</div>
          )}
          <button onClick={() => setCreaNuovo(true)} style={btn("ghost", { marginTop: 8, fontSize: 12, padding: "8px 10px", width: "100%" })}>+ Inserisci nuovo cliente</button>
        </>
      )}
      {cliente && (
        <div style={{ background: K.bg, border: `1px solid ${K.border}`, borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: K.text }}>{cliente.cognome} {cliente.nome}</div>
            <div style={{ fontSize: 11, color: K.muted }}>{cliente.cellulare || "—"} · {cliente.email || "—"}</div>
          </div>
          <button onClick={() => setCliente(null)} style={btn("ghost", { padding: "4px 10px", fontSize: 11 })}>cambia</button>
        </div>
      )}
      {creaNuovo && (
        <div style={{ background: K.bg, border: `1px solid ${K.border}`, borderRadius: 8, padding: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={nuovoCli.nome} onChange={e => setNuovoCli({ ...nuovoCli, nome: e.target.value })} placeholder="Nome *" style={inp} />
            <input value={nuovoCli.cognome} onChange={e => setNuovoCli({ ...nuovoCli, cognome: e.target.value })} placeholder="Cognome *" style={inp} />
          </div>
          <input value={nuovoCli.telefono} onChange={e => setNuovoCli({ ...nuovoCli, telefono: e.target.value })} placeholder="Telefono" style={{ ...inp, marginTop: 8 }} />
          <input value={nuovoCli.email} onChange={e => setNuovoCli({ ...nuovoCli, email: e.target.value })} placeholder="Email (per la conferma)" style={{ ...inp, marginTop: 8 }} />
          <button onClick={() => setCreaNuovo(false)} style={btn("ghost", { marginTop: 8, fontSize: 11, padding: "6px 8px" })}>← cerca esistente</button>
        </div>
      )}

      {/* TIPO SEDUTA */}
      <div style={lblBlock}>Tipo seduta</div>
      <select value={tipoSeduta} onChange={e => setTipoSeduta(e.target.value)} style={inp}>
        <option value="EMS">EMS</option>
        <option value="VACUFIT">Vacufit</option>
        <option value="PRIMA_CONSULENZA">Prima consulenza</option>
        <option value="NUTRIZIONE">Nutrizionista</option>
        <option value="CHECKUP">Check-up / BIA</option>
        <option value="ALTRO">Altro</option>
      </select>

      {/* DURATA */}
      <div style={lblBlock}>Durata</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[30, 60, 90, 120].map(m => (
          <button key={m} onClick={() => setDurata(m)} style={btn(durata === m ? "primary" : "ghost", { flex: 1, fontSize: 12, padding: "8px 6px" })}>{m} min</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: K.muted, marginTop: 6 }}>Termine: <strong style={{ color: K.gold }}>{oraFineCalc}</strong></div>

      {/* NOTE */}
      <div style={lblBlock}>Note (opzionale)</div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} placeholder="Note interne..." />

      {err && <div style={{ marginTop: 10, color: K.red, fontSize: 12 }}>{err}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btn("ghost", { flex: 1, padding: "10px 12px" })}>Annulla</button>
        <button onClick={salva} disabled={saving} style={btn("primary", { flex: 2, padding: "10px 12px", opacity: saving ? 0.5 : 1 })}>
          {saving ? "Salvataggio..." : "Conferma prenotazione"}
        </button>
      </div>
    </Modal>
  );
}

// ====== MODAL DETTAGLIO ======

function ModalDettaglio({ app, onClose, onChanged }) {
  const [working, setWorking] = useState(false);

  const cancella = async () => {
    if (!window.confirm("Cancellare questa prenotazione?")) return;
    setWorking(true);
    await sb.from("appuntamento").update({ stato: "cancellato", updated_at: new Date().toISOString() }).eq("id", app.id);
    setWorking(false);
    onChanged();
  };

  const completa = async () => {
    setWorking(true);
    await sb.from("appuntamento").update({ stato: "completato", updated_at: new Date().toISOString() }).eq("id", app.id);
    setWorking(false);
    onChanged();
  };

  const noShow = async () => {
    if (!window.confirm("Segnare come NO-SHOW (cliente non presentato)?")) return;
    setWorking(true);
    await sb.from("appuntamento").update({ stato: "no_show", updated_at: new Date().toISOString() }).eq("id", app.id);
    setWorking(false);
    onChanged();
  };

  return (
    <Modal onClose={onClose} titolo="Dettaglio prenotazione">
      <div style={{ background: K.bg, border: `1px solid ${K.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: K.text }}>{app.cliente_nome} {app.cliente_cognome}</div>
        <div style={{ fontSize: 12, color: K.muted, marginTop: 4 }}>
          📅 {new Date(app.data + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}<br/>
          🕐 {app.ora_inizio?.slice(0, 5)} - {app.ora_fine?.slice(0, 5)}<br/>
          🏷 {app.tipo_seduta || "—"}<br/>
          📞 {app.cliente_telefono || "—"}<br/>
          ✉ {app.cliente_email || "—"}
        </div>
        {app.note && <div style={{ marginTop: 8, fontSize: 12, color: K.text, background: K.surface, padding: 8, borderRadius: 6 }}>{app.note}</div>}
      </div>

      {app.cliente_telefono && (
        <a href={`https://wa.me/${(app.cliente_telefono || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ ...btn("ghost", { padding: "10px 12px", display: "block", textDecoration: "none", textAlign: "center", marginBottom: 8 }), color: "#25D366" }}>
          💬 Scrivi su WhatsApp
        </a>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
        <button onClick={completa} disabled={working} style={btn("ghost", { padding: "10px 12px", color: K.green, borderColor: K.green + "55" })}>✓ Completato</button>
        <button onClick={noShow} disabled={working} style={btn("ghost", { padding: "10px 12px", color: "#f59e0b", borderColor: "#f59e0b55" })}>⚠ No-show</button>
      </div>
      <button onClick={cancella} disabled={working} style={{ ...btn("ghost", { padding: "10px 12px", width: "100%", marginTop: 8 }), color: K.red, borderColor: K.red + "55" }}>Cancella prenotazione</button>

      <button onClick={onClose} style={btn("ghost", { padding: "10px 12px", width: "100%", marginTop: 12 })}>Chiudi</button>
    </Modal>
  );
}

// ====== HELPERS ======

function Modal({ titolo, children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14,
        padding: 20, maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 12px 40px rgba(0,0,0,.6)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: K.gold, fontWeight: 600 }}>{titolo}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: K.muted, fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Riepilogo({ slot, oraFine }) {
  return (
    <div style={{ background: K.goldBg, border: `1px solid ${K.gold}55`, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12 }}>
      <div style={{ color: K.gold, fontWeight: 600 }}>{slot.risorsa_nome}</div>
      <div style={{ color: K.text, marginTop: 4 }}>
        {new Date(slot.data + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })} · {slot.ora_inizio} – {oraFine}
      </div>
    </div>
  );
}

function suggerisciTipo(nome) {
  const n = (nome || "").toLowerCase();
  if (n.includes("ems")) return "EMS";
  if (n.includes("vacu")) return "VACUFIT";
  if (n.includes("nutri")) return "NUTRIZIONE";
  return "ALTRO";
}

function toMin(hms) { const [h, m] = (hms || "00:00").split(":").map(Number); return h * 60 + m; }
function fromMin(min) { const h = Math.floor(min / 60), m = min % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }

const inp = {
  width: "100%", padding: "9px 11px", fontSize: 13, background: K.bg,
  border: `1px solid ${K.border}`, borderRadius: 8, color: K.text,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const lblBlock = { fontSize: 11, color: K.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 6 };

function btn(kind, extra = {}) {
  const base = { border: "1px solid", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontFamily: "inherit", transition: "all .15s" };
  if (kind === "primary") return { ...base, background: K.gold, borderColor: K.gold, color: K.bg, ...extra };
  return { ...base, background: "transparent", borderColor: K.border, color: K.text, ...extra };
}
