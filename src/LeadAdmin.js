import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const K = {
  gold:"#D4A843", goldBg:"#141008", goldBorder:"#2e2510",
  black:"#080808", card:"#111", border:"#1e1e1e", borderMid:"#2a2a2a",
  white:"#F5F5F5", muted:"#666", mutedMid:"#999", mutedLight:"#bbb",
  success:"#2a9d6f", successBg:"#081a12", successBorder:"#0f3020",
  danger:"#c0392b", dangerBg:"#160808", dangerBorder:"#2e1010",
  info:"#3a7bd5", infoBg:"#08101e", infoBorder:"#102030",
};
const C = (ex={}) => ({ background:K.card, border:`1px solid ${K.border}`, borderRadius:12, padding:"14px", marginBottom:10, ...ex });
const B = (v="gold", ex={}) => {
  const s = {
    gold:   {background:K.gold, color:"#080808", border:"none", fontWeight:600},
    outline:{background:"transparent", color:K.gold, border:`1px solid ${K.goldBorder}`},
    ghost:  {background:"transparent", color:K.mutedLight, border:`1px solid ${K.border}`},
    success:{background:K.successBg, color:K.success, border:`1px solid ${K.successBorder}`},
    danger: {background:K.dangerBg, color:K.danger, border:`1px solid ${K.dangerBorder}`},
    info:   {background:K.infoBg, color:K.info, border:`1px solid ${K.infoBorder}`},
  };
  return {...s[v], borderRadius:8, padding:"9px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", ...ex};
};
const Tag = (color, bg, border) => ({ background:bg, color, border:`1px solid ${border||bg}`, fontSize:11, fontWeight:500, padding:"3px 9px", borderRadius:20, display:"inline-block", whiteSpace:"nowrap" });

// Normalizza un numero italiano a solo cifre senza prefisso +39/0039/39 e senza zero iniziale.
const cleanPhoneIT = (t) => {
  let s = (t||"").replace(/[^0-9+]/g,"").replace(/^\+/,"");
  if (s.startsWith("0039")) s = s.slice(4);
  if (s.startsWith("39") && s.length >= 11) s = s.slice(2);
  if (s.startsWith("0")) s = s.slice(1);
  return s;
};
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "—";
const fmtDateTime = (s) => s ? new Date(s).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";

const waTel = (lead) => cleanPhoneIT(lead?.cellulare || lead?.telefono_normalizzato);
const waMessage = (lead) => {
  const nome = (lead?.nome || "").split(" ")[0];
  return `Buongiorno ${nome}! 😊 Sono Christian di Fit And Go Padova ⚡. Ti scrivo perché ho ricevuto la tua richiesta per la prova gratuita! 🎁\n\nPer organizzarla al meglio, posso chiederti quale obiettivo ti piacerebbe raggiungere? 🎯 (Ad esempio: rimetterti in forma in poco tempo ⏱️, tonificare 💪, o combattere la ritenzione idrica 💧?)\n\nCosì capiamo insieme se è più adatto a te l'allenamento EMS, il Vacufit o entrambi! 🏃‍♀️🔥`;
};
// Copia il messaggio negli appunti e apre WhatsApp con la sola chat (senza testo nell'URL,
// che altrimenti corromperebbe le emoji 4-byte UTF-8 su WhatsApp Desktop).
// L'utente fa Ctrl+V e le emoji arrivano integre dal clipboard.
const apriWA = async (lead) => {
  const tel = waTel(lead);
  if (!tel) return;
  const text = waMessage(lead);
  // Backup in clipboard
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position="fixed"; ta.style.opacity="0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch(_){}
      document.body.removeChild(ta);
    }
  } catch(_){}
  // Mobile -> wa.me (no bug emoji su app mobile)
  // Desktop -> web.whatsapp.com (browser, gestisce UTF-8 nei params correttamente)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const url = isMobile
    ? `https://wa.me/39${tel}?text=${encodeURIComponent(text)}`
    : `https://web.whatsapp.com/send?phone=39${tel}&text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

const STATI = ["nuovo", "contattato", "convertito", "scartato"];
const STATO_COLORS = {
  nuovo:      {bg:K.goldBg,     fg:K.gold,    bd:K.goldBorder},
  contattato: {bg:K.infoBg,     fg:K.info,    bd:K.infoBorder},
  convertito: {bg:K.successBg,  fg:K.success, bd:K.successBorder},
  scartato:   {bg:"#0e0e0e",    fg:K.muted,   bd:K.borderMid},
};

export default function LeadAdmin({ navTarget }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("nonletti");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editContatti, setEditContatti] = useState(false);
  const [editTel, setEditTel] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNome, setEditNome] = useState("");
  const [editCognome, setEditCognome] = useState("");
  const [editFonte, setEditFonte] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingContatti, setSavingContatti] = useState(false);

  const apriModifica = (l) => {
    setEditNome(l.nome || "");
    setEditCognome(l.cognome || "");
    setEditTel(l.cellulare || "");
    setEditEmail(l.email || "");
    setEditFonte(l.fonte || "");
    setEditNote(l.note || "");
    setEditContatti(true);
  };
  useEffect(() => {
    if (navTarget && navTarget.tab === "lead" && navTarget.id) {
      setSel(navTarget.id);
      setFilter("tutti");
    }
  }, [navTarget]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("leads")
      .select("*").order("created_at", { ascending: false });
    if (!error) setLeads(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStato = async (id, nuovoStato, extra = {}) => {
    setSavingId(id);
    const patch = { stato: nuovoStato, ...extra };
    if (nuovoStato === "contattato" && !leads.find(l=>l.id===id)?.contattato_at) {
      patch.contattato_at = new Date().toISOString();
    }
    if (nuovoStato === "convertito") {
      patch.convertito_at = new Date().toISOString();
    }
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    }
    setSavingId(null);
  };

  const markWhatsappSent = async (id) => {
    const l = leads.find(x => x.id === id);
    const counter = (l?.numero_contatti_whatsapp || 0) + 1;
    await updateStato(id, "contattato", {
      whatsapp_inviato: true,
      whatsapp_inviato_at: new Date().toISOString(),
      ultimo_contatto_at: new Date().toISOString(),
      numero_contatti_whatsapp: counter,
    });
  };

  const apriDettaglio = async (id) => {
    setSel(id);
    // Marca come letto se non lo era
    const l = leads.find(x => x.id === id);
    if (l && !l.letto) {
      const patch = { letto: true, letto_at: new Date().toISOString() };
      await supabase.from("leads").update(patch).eq("id", id);
      setLeads(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
    }
  };

  const segnaTuttiLetti = async () => {
    if (!window.confirm("Segnare TUTTI i lead non letti come letti?")) return;
    const nonLetti = leads.filter(l => !l.letto).map(l => l.id);
    if (nonLetti.length === 0) return;
    const at = new Date().toISOString();
    await supabase.from("leads").update({ letto: true, letto_at: at }).in("id", nonLetti);
    setLeads(prev => prev.map(l => nonLetti.includes(l.id) ? { ...l, letto: true, letto_at: at } : l));
  };

  const toggleSel = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const clearSel = () => setSelected(new Set());
  const selectAllVisible = () => setSelected(new Set(filtered.map(l => l.id)));

  const bulkMarkLetti = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const at = new Date().toISOString();
    await supabase.from("leads").update({ letto: true, letto_at: at }).in("id", ids);
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, letto: true, letto_at: at } : l));
    clearSel();
    setBulkBusy(false);
  };

  const bulkScarta = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Scartare ${selected.size} lead selezionati?`)) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    await supabase.from("leads").update({ stato: "scartato" }).in("id", ids);
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, stato: "scartato" } : l));
    clearSel();
    setBulkBusy(false);
  };

  const bulkContattati = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const at = new Date().toISOString();
    await supabase.from("leads").update({ stato: "contattato", contattato_at: at, letto: true, letto_at: at }).in("id", ids);
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, stato: "contattato", contattato_at: at, letto: true, letto_at: at } : l));
    clearSel();
    setBulkBusy(false);
  };

  const salvaContatti = async (id) => {
    setSavingContatti(true);
    const telPulito = (editTel || "").trim();
    const telNorm = telPulito ? telPulito.replace(/[^0-9]/g, "") : null;
    const patch = {
      nome: (editNome || "").trim() || null,
      cognome: (editCognome || "").trim() || null,
      cellulare: telPulito || null,
      telefono_normalizzato: telNorm,
      email: (editEmail || "").trim() || null,
      fonte: (editFonte || "").trim() || null,
      note: (editNote || "").trim() || null,
    };
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
      setEditContatti(false);
    } else {
      alert("Errore salvataggio: " + error.message);
    }
    setSavingContatti(false);
  };

  if (loading) return (
    <div style={{display:"flex",justifyContent:"center",padding:"4rem"}}>
      <div style={{width:32,height:32,border:`3px solid ${K.border}`,borderTop:`3px solid ${K.gold}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const counts = STATI.reduce((acc, s) => { acc[s] = leads.filter(l => l.stato === s).length; return acc; }, {});
  counts.nonletti = leads.filter(l => !l.letto).length;

  const filtered = leads
    .filter(l => {
      if (filter === "tutti") return true;
      if (filter === "nonletti") return !l.letto;
      return l.stato === filter;
    })
    .filter(l => {
      if (!search) return true;
      const q = search.toLowerCase();
      return [l.nome, l.cognome, l.email, l.cellulare, l.fonte]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });

  /* ─── DETTAGLIO LEAD ─── */
  if (sel) {
    const l = leads.find(x => x.id === sel);
    if (!l) { setSel(null); return null; }
    const tel = waTel(l);
    const sc = STATO_COLORS[l.stato] || STATO_COLORS.nuovo;

    return (
      <div>
        <button onClick={()=>setSel(null)} style={B("ghost",{marginBottom:16,fontSize:12})}>← Tutti i lead</button>
        <div style={C({border:`1px solid ${sc.bd}`,background:sc.bg})}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:6}}>
            <div>
              <div style={{fontSize:20,fontWeight:600,color:K.white}}>{l.nome||""} {l.cognome||""}</div>
              <div style={{fontSize:11,color:K.muted,marginTop:4}}>Ricevuto {fmtDateTime(l.created_at)}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
              <span style={Tag(sc.fg, sc.bg, sc.bd)}>{l.stato}</span>
              {!editContatti && <button onClick={()=>apriModifica(l)} style={B("outline",{padding:"4px 10px",fontSize:11})}>✏️ Modifica</button>}
            </div>
          </div>
        </div>

        <div style={C()}>
          <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:8}}>CONTATTI</div>
          {!editContatti ? (
            <>
              {l.cellulare && <div style={{fontSize:14,marginBottom:4}}>📱 <a href={`tel:${l.cellulare}`} style={{color:K.gold,textDecoration:"none"}}>{l.cellulare}</a></div>}
              {l.email && <div style={{fontSize:14,marginBottom:4}}>✉️ <a href={`mailto:${l.email}`} style={{color:K.gold,textDecoration:"none",wordBreak:"break-all"}}>{l.email}</a></div>}
              {!l.cellulare && !l.email && <div style={{fontSize:12,color:K.muted,fontStyle:"italic"}}>Nessun contatto. Clicca "✏️ Modifica" per aggiungere il numero.</div>}
              {!l.cellulare && l.email && <div style={{fontSize:11,color:K.gold,marginTop:6}}>💡 Aggiungi il numero per poterlo contattare via WhatsApp</div>}
            </>
          ) : (
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Nome</label>
                  <input value={editNome} onChange={e=>setEditNome(e.target.value)} placeholder="Nome"
                    style={{width:"100%",background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Cognome</label>
                  <input value={editCognome} onChange={e=>setEditCognome(e.target.value)} placeholder="Cognome"
                    style={{width:"100%",background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit"}}/>
                </div>
              </div>
              <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Telefono / cellulare</label>
              <input value={editTel} onChange={e=>setEditTel(e.target.value)} placeholder="Es. +39 349 379 8171" type="tel"
                style={{width:"100%",background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",marginBottom:10}}/>
              <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Email</label>
              <input value={editEmail} onChange={e=>setEditEmail(e.target.value)} placeholder="email@esempio.it" type="email"
                style={{width:"100%",background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",marginBottom:10}}/>
              <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Fonte</label>
              <input value={editFonte} onChange={e=>setEditFonte(e.target.value)} placeholder="Es. Instagram, Sito, Passaparola"
                style={{width:"100%",background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",marginBottom:10}}/>
              <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Note</label>
              <textarea value={editNote} onChange={e=>setEditNote(e.target.value)} rows={2} placeholder="Annotazioni libere sul lead"
                style={{width:"100%",background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",resize:"vertical",marginBottom:10}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>salvaContatti(l.id)} disabled={savingContatti} style={{...B("success",{flex:1,padding:"10px",fontSize:12})}}>{savingContatti?"Salvataggio...":"💾 Salva"}</button>
                <button onClick={()=>setEditContatti(false)} style={{...B("ghost",{padding:"10px 14px",fontSize:12})}}>Annulla</button>
              </div>
            </div>
          )}
        </div>

        <div style={C()}>
          <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:8}}>ORIGINE</div>
          {l.fonte && <div style={{fontSize:13,marginBottom:4}}>Fonte: <span style={{color:K.gold}}>{l.fonte}</span></div>}
          {l.campagna && <div style={{fontSize:13,marginBottom:4}}>Campagna: <span style={{color:K.mutedLight}}>{l.campagna}</span></div>}
          {l.email_subject && <div style={{fontSize:12,color:K.muted,marginTop:6}}>Oggetto mail: {l.email_subject}</div>}
        </div>

        {l.messaggio && <div style={C()}>
          <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:8}}>MESSAGGIO</div>
          <div style={{fontSize:13,color:K.mutedLight,whiteSpace:"pre-wrap"}}>{l.messaggio}</div>
        </div>}

        {tel && <button onClick={async()=>{await apriWA(l); markWhatsappSent(l.id);}}
          style={{...B("success"),display:"block",width:"100%",textAlign:"center",padding:"14px",fontSize:14,marginBottom:6,fontWeight:600,cursor:"pointer"}}>
          💬 Apri WhatsApp con messaggio precompilato
        </button>}
        {tel && <div style={{fontSize:11,color:K.muted,textAlign:"center",marginBottom:10,padding:"0 8px"}}>
          Si apre WhatsApp Web con il messaggio già pronto. Se non compare, il testo è anche negli appunti: incolla con Ctrl+V.
        </div>}
        {!tel && <div style={C({textAlign:"center",color:K.muted,fontSize:12,padding:"14px"})}>
          ⚠️ Nessun numero di telefono valido per WhatsApp
        </div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>
          <button onClick={()=>updateStato(l.id,"contattato")} disabled={savingId===l.id||l.stato==="contattato"}
            style={{...B(l.stato==="contattato"?"flat":"info"),opacity:l.stato==="contattato"?0.5:1}}>
            {l.stato==="contattato"?"✓ Contattato":"📞 Segna contattato"}
          </button>
          <button onClick={()=>updateStato(l.id,"convertito")} disabled={savingId===l.id||l.stato==="convertito"}
            style={{...B(l.stato==="convertito"?"flat":"success"),opacity:l.stato==="convertito"?0.5:1}}>
            {l.stato==="convertito"?"✓ Convertito":"🏆 Convertito"}
          </button>
          <button onClick={()=>updateStato(l.id,"nuovo")} disabled={savingId===l.id||l.stato==="nuovo"}
            style={{...B("ghost"),opacity:l.stato==="nuovo"?0.5:1}}>↺ Riapri</button>
          <button onClick={()=>{if(window.confirm("Scartare definitivamente questo lead?"))updateStato(l.id,"scartato")}}
            disabled={savingId===l.id||l.stato==="scartato"}
            style={{...B("danger"),opacity:l.stato==="scartato"?0.5:1}}>🗑 Scarta</button>
        </div>

        {/* Avvisi tracking: riinvii arrivati + contatti inviati */}
        {(l.numero_riinvii > 0 || l.numero_contatti_whatsapp > 0) && (
          <div style={{marginTop:14, padding:"10px 12px", background:"#1a1308", border:"1px solid #D4A84355", borderRadius:8, fontSize:12, color:"#fbbf24"}}>
            {l.numero_riinvii > 0 && (
              <div>🔁 Lead ricevuto <strong>{l.numero_riinvii + 1} volte</strong> (ultimo riinvio: {l.ultimo_riinvio_at ? fmtDateTime(l.ultimo_riinvio_at) : "—"})</div>
            )}
            {l.numero_contatti_whatsapp > 0 && (
              <div style={{marginTop: l.numero_riinvii>0 ? 4 : 0}}>💬 Già contattato su WhatsApp <strong>{l.numero_contatti_whatsapp} {l.numero_contatti_whatsapp===1?"volta":"volte"}</strong> (ultimo: {l.ultimo_contatto_at ? fmtDateTime(l.ultimo_contatto_at) : (l.whatsapp_inviato_at ? fmtDateTime(l.whatsapp_inviato_at) : "—")})</div>
            )}
          </div>
        )}
        {l.whatsapp_inviato_at && !l.numero_contatti_whatsapp && <div style={{fontSize:11,color:K.muted,textAlign:"center",marginTop:14}}>
          ✓ WhatsApp inviato il {fmtDateTime(l.whatsapp_inviato_at)}
        </div>}
      </div>
    );
  }

  /* ─── LISTA LEAD ─── */
  const nonLettiCount = leads.filter(l => !l.letto).length;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontWeight:600,fontSize:16}}>Lead ({leads.length}){nonLettiCount>0 && <span style={{color:K.gold,marginLeft:8,fontSize:13}}>· {nonLettiCount} da leggere</span>}</div>
          <div style={{fontSize:12,color:K.muted,marginTop:2}}>Contatti dalle campagne, sito, Gmail</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {nonLettiCount>0 && <button onClick={segnaTuttiLetti} style={B("ghost",{padding:"6px 10px",fontSize:11})}>✓ Tutti letti</button>}
          <button onClick={load} style={B("ghost",{padding:"6px 10px",fontSize:11})}>↻ Aggiorna</button>
        </div>
      </div>

      {/* BARRA AZIONI BULK (visibile quando ≥1 lead selezionato) */}
      {selected.size > 0 && (
        <div style={{position:"sticky",top:0,zIndex:50,background:K.goldBg,border:`1px solid ${K.gold}`,borderRadius:8,padding:"10px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:13,color:K.gold,fontWeight:600,marginRight:4}}>{selected.size} selezionati</span>
          <button onClick={bulkMarkLetti} disabled={bulkBusy} style={B("ghost",{padding:"6px 10px",fontSize:11})}>✓ Letti</button>
          <button onClick={bulkContattati} disabled={bulkBusy} style={B("info",{padding:"6px 10px",fontSize:11})}>📞 Contattati</button>
          <button onClick={bulkScarta} disabled={bulkBusy} style={B("danger",{padding:"6px 10px",fontSize:11})}>🗑 Scarta</button>
          <div style={{flex:1}}/>
          <button onClick={selectAllVisible} style={B("ghost",{padding:"6px 10px",fontSize:11})}>Tutti visibili</button>
          <button onClick={clearSel} style={B("ghost",{padding:"6px 10px",fontSize:11})}>Annulla</button>
        </div>
      )}

      {/* Filtri stato */}
      <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",paddingBottom:4}}>
        {[["nonletti","Da leggere"],["nuovo","Nuovi"],["contattato","Contattati"],["convertito","Convertiti"],["scartato","Scartati"],["tutti","Tutti"]].map(([k,lab])=>{
          const n = k === "tutti" ? leads.length : (counts[k] || 0);
          const active = filter === k;
          return (
            <button key={k} onClick={()=>setFilter(k)} style={{
              flexShrink:0,
              background: active ? K.goldBg : "transparent",
              border: `1px solid ${active ? K.gold : K.border}`,
              color: active ? K.gold : K.mutedLight,
              borderRadius: 8, padding:"7px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit"
            }}>{lab} ({n})</button>
          );
        })}
      </div>

      {/* Ricerca */}
      <input
        placeholder="Cerca per nome, telefono, email…"
        value={search} onChange={e=>setSearch(e.target.value)}
        style={{
          width:"100%",background:"#111",border:`1px solid ${K.border}`,
          color:K.white,borderRadius:8,padding:"10px 12px",fontSize:13,
          fontFamily:"inherit",marginBottom:12
        }}/>

      {filtered.length === 0 ? (
        <div style={C({textAlign:"center",padding:"3rem 1rem",color:K.muted})}>
          {search ? `Nessun lead corrisponde a "${search}"` : "Nessun lead in questo stato"}
        </div>
      ) : filtered.map(l => {
        const sc = STATO_COLORS[l.stato] || STATO_COLORS.nuovo;
        const tel = waTel(l);
        return (
          <div key={l.id} style={C({cursor:"pointer",border:`1px solid ${selected.has(l.id)?K.gold:sc.bd}`,position:"relative",background:selected.has(l.id)?K.goldBg:undefined})}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <input type="checkbox" checked={selected.has(l.id)} onChange={(e)=>{e.stopPropagation();toggleSel(l.id);}} onClick={(e)=>e.stopPropagation()}
                style={{width:18,height:18,accentColor:K.gold,cursor:"pointer",flexShrink:0}}/>
              <div onClick={()=>apriDettaglio(l.id)} style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
              <div style={{
                width:36,height:36,borderRadius:"50%",
                background:sc.bg,border:`1px solid ${sc.bd}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,fontWeight:600,color:sc.fg,flexShrink:0,
                position:"relative"
              }}>
                {(l.nome||"?")[0]}{(l.cognome||"?")[0]}
                {!l.letto && <div style={{position:"absolute",top:-2,right:-2,width:10,height:10,borderRadius:"50%",background:K.gold,border:`2px solid ${K.black}`}}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {l.nome||""} {l.cognome||""}
                </div>
                <div style={{fontSize:11,color:K.muted,marginTop:2,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <span>{l.fonte || "—"} · {fmtDate(l.created_at)}</span>
                  {l.numero_riinvii > 0 && (
                    <span style={{background:"#7c2d12",color:"#fbbf24",padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}} title={`Stesso lead arrivato ${l.numero_riinvii+1} volte`}>
                      🔁 x{l.numero_riinvii+1}
                    </span>
                  )}
                  {l.numero_contatti_whatsapp > 0 && (
                    <span style={{background:"#064e3b",color:"#34d399",padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}} title={`Già contattato ${l.numero_contatti_whatsapp} volte su WhatsApp`}>
                      💬 {l.numero_contatti_whatsapp}
                    </span>
                  )}
                </div>
              </div>
              <span style={Tag(sc.fg, sc.bg, sc.bd)}>{l.stato}</span>
              </div>
            </div>
            {(l.cellulare || l.email) && (
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {tel && (
                  <button
                     onClick={async(e)=>{
                       e.stopPropagation();
                       if (l.numero_contatti_whatsapp > 0) {
                         const conferma = window.confirm(`⚠ Hai già contattato ${l.nome||""} ${l.cognome||""} su WhatsApp ${l.numero_contatti_whatsapp} ${l.numero_contatti_whatsapp===1?"volta":"volte"}.\n\nUltimo contatto: ${l.ultimo_contatto_at ? new Date(l.ultimo_contatto_at).toLocaleString("it-IT") : "—"}\n\nVuoi contattarlo di nuovo?`);
                         if (!conferma) return;
                       }
                       await apriWA(l);
                       markWhatsappSent(l.id);
                     }}
                     style={{...B(l.numero_contatti_whatsapp>0?"ghost":"success",{flex:1,padding:"7px 10px",fontSize:11,textAlign:"center",cursor:"pointer"}),minWidth:0}}>
                    💬 WhatsApp{l.numero_contatti_whatsapp>0?` (${l.numero_contatti_whatsapp})`:""}
                  </button>
                )}
                {(l.cellulare || l.telefono_normalizzato) && (
                  <a href={`tel:${l.cellulare||l.telefono_normalizzato}`} onClick={e=>e.stopPropagation()}
                     style={{...B("info",{flex:1,padding:"7px 10px",fontSize:11,textDecoration:"none",textAlign:"center"}),minWidth:0}}>
                    📞 Chiama
                  </a>
                )}
                {!tel && l.email && (
                  <a href={`mailto:${l.email}`} onClick={e=>e.stopPropagation()}
                     style={{...B("info",{flex:1,padding:"7px 10px",fontSize:11,textDecoration:"none",textAlign:"center"}),minWidth:0}}>
                    ✉️ Email
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
