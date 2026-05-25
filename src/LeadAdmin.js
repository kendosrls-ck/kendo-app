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

const cleanPhoneIT = (t) => (t||"").replace(/[^0-9+]/g,"").replace(/^\+39/,"").replace(/^39/,"");
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "—";
const fmtDateTime = (s) => s ? new Date(s).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";

const waLink = (lead) => {
  const tel = cleanPhoneIT(lead?.cellulare || lead?.telefono_normalizzato);
  if (!tel) return null;
  const nome = (lead?.nome || "").split(" ")[0];
  const text = `Buongiorno ${nome}! 😊 Sono Christian di Fit And Go Padova ⚡. Ti scrivo perché ho ricevuto la tua richiesta per la prova gratuita! 🎁\n\nPer organizzarla al meglio, posso chiederti quale obiettivo ti piacerebbe raggiungere? 🎯 (Ad esempio: rimetterti in forma in poco tempo ⏱️, tonificare 💪, o combattere la ritenzione idrica 💧?)\n\nCosì capiamo insieme se è più adatto a te l'allenamento EMS, il Vacufit o entrambi! 🏃‍♀️🔥`;
  return `https://api.whatsapp.com/send?phone=39${tel}&text=${encodeURIComponent(text)}`;
};

const STATI = ["nuovo", "contattato", "convertito", "scartato"];
const STATO_COLORS = {
  nuovo:      {bg:K.goldBg,     fg:K.gold,    bd:K.goldBorder},
  contattato: {bg:K.infoBg,     fg:K.info,    bd:K.infoBorder},
  convertito: {bg:K.successBg,  fg:K.success, bd:K.successBorder},
  scartato:   {bg:"#0e0e0e",    fg:K.muted,   bd:K.borderMid},
};

export default function LeadAdmin() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("nuovo");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(null);
  const [savingId, setSavingId] = useState(null);

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
    await updateStato(id, "contattato", { whatsapp_inviato: true, whatsapp_inviato_at: new Date().toISOString() });
  };

  if (loading) return (
    <div style={{display:"flex",justifyContent:"center",padding:"4rem"}}>
      <div style={{width:32,height:32,border:`3px solid ${K.border}`,borderTop:`3px solid ${K.gold}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const counts = STATI.reduce((acc, s) => { acc[s] = leads.filter(l => l.stato === s).length; return acc; }, {});

  const filtered = leads
    .filter(l => filter === "tutti" || l.stato === filter)
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
    const wa = waLink(l);
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
            <span style={Tag(sc.fg, sc.bg, sc.bd)}>{l.stato}</span>
          </div>
        </div>

        <div style={C()}>
          <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:8}}>CONTATTI</div>
          {l.cellulare && <div style={{fontSize:14,marginBottom:4}}>📱 <a href={`tel:${l.cellulare}`} style={{color:K.gold,textDecoration:"none"}}>{l.cellulare}</a></div>}
          {l.email && <div style={{fontSize:14,marginBottom:4}}>✉️ <a href={`mailto:${l.email}`} style={{color:K.gold,textDecoration:"none",wordBreak:"break-all"}}>{l.email}</a></div>}
          {!l.cellulare && !l.email && <div style={{fontSize:12,color:K.muted,fontStyle:"italic"}}>Nessun contatto disponibile</div>}
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

        {wa && <a href={wa} target="_blank" rel="noreferrer" onClick={()=>markWhatsappSent(l.id)}
          style={{...B("success"),display:"block",textAlign:"center",textDecoration:"none",padding:"14px",fontSize:14,marginBottom:10,fontWeight:600}}>
          💬 Apri WhatsApp con messaggio preimpostato
        </a>}
        {!wa && <div style={C({textAlign:"center",color:K.muted,fontSize:12,padding:"14px"})}>
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

        {l.whatsapp_inviato_at && <div style={{fontSize:11,color:K.muted,textAlign:"center",marginTop:14}}>
          ✓ WhatsApp inviato il {fmtDateTime(l.whatsapp_inviato_at)}
        </div>}
      </div>
    );
  }

  /* ─── LISTA LEAD ─── */
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontWeight:600,fontSize:16}}>Lead ({leads.length})</div>
          <div style={{fontSize:12,color:K.muted,marginTop:2}}>Contatti dalle campagne, sito, Gmail</div>
        </div>
        <button onClick={load} style={B("ghost",{padding:"6px 10px",fontSize:11})}>↻ Aggiorna</button>
      </div>

      {/* Filtri stato */}
      <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",paddingBottom:4}}>
        {[["nuovo","Nuovi"],["contattato","Contattati"],["convertito","Convertiti"],["scartato","Scartati"],["tutti","Tutti"]].map(([k,lab])=>{
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
        const wa = waLink(l);
        return (
          <div key={l.id} onClick={()=>setSel(l.id)} style={C({cursor:"pointer",border:`1px solid ${sc.bd}`})}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{
                width:36,height:36,borderRadius:"50%",
                background:sc.bg,border:`1px solid ${sc.bd}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,fontWeight:600,color:sc.fg,flexShrink:0
              }}>{(l.nome||"?")[0]}{(l.cognome||"?")[0]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {l.nome||""} {l.cognome||""}
                </div>
                <div style={{fontSize:11,color:K.muted,marginTop:2}}>
                  {l.fonte || "—"} · {fmtDate(l.created_at)}
                </div>
              </div>
              <span style={Tag(sc.fg, sc.bg, sc.bd)}>{l.stato}</span>
            </div>
            {(l.cellulare || l.email) && (
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {l.cellulare && wa && (
                  <a href={wa} target="_blank" rel="noreferrer"
                     onClick={(e)=>{e.stopPropagation();markWhatsappSent(l.id);}}
                     style={{...B("success",{flex:1,padding:"7px 10px",fontSize:11,textDecoration:"none",textAlign:"center"}),minWidth:0}}>
                    💬 WhatsApp
                  </a>
                )}
                {l.cellulare && (
                  <a href={`tel:${l.cellulare}`} onClick={e=>e.stopPropagation()}
                     style={{...B("info",{flex:1,padding:"7px 10px",fontSize:11,textDecoration:"none",textAlign:"center"}),minWidth:0}}>
                    📞 Chiama
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
