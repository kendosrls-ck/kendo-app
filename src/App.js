import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = "https://tqckdjglvffeitltgpuk.supabase.co";
const SUPABASE_ANON_KEY ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2tkamdsdmZmZWl0bHRncHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzg5NjAsImV4cCI6MjA5NDkxNDk2MH0.NdG4SejA0jJR5hUZfG3ZS5OHA4nAazoPkGT3xMFehpU;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ─── PALETTE ─── */
const K = {
  gold:"#D4A843", goldHover:"#E8BC55", goldDim:"#8a6e28",
  goldBg:"#141008", goldBorder:"#2e2510",
  black:"#080808", card:"#111111", cardHover:"#161616",
  surface:"#0e0e0e", surfaceHigh:"#181818",
  white:"#F5F5F5", muted:"#666", mutedMid:"#999", mutedLight:"#bbb",
  success:"#2a9d6f", successBg:"#081a12", successBorder:"#0f3020",
  danger:"#c0392b", dangerBg:"#160808", dangerBorder:"#2e1010",
  info:"#3a7bd5", infoBg:"#08101e",
  border:"#1e1e1e", borderMid:"#2a2a2a",
};

const gs = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:${K.black};-webkit-font-smoothing:antialiased}
input,textarea,select{background:#111!important;border:1px solid #222!important;color:${K.white}!important;border-radius:8px;padding:10px 12px;font-size:14px;width:100%;font-family:inherit;transition:border .2s}
input:focus,textarea:focus,select:focus{outline:none!important;border-color:${K.gold}!important;background:#141008!important}
select option{background:#111;color:${K.white}}
textarea{resize:none}
::-webkit-scrollbar{width:2px}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px}
`;

const C = (extra={}) => ({ background:K.card, border:`1px solid ${K.border}`, borderRadius:12, padding:"16px", marginBottom:10, ...extra });
const B = (v="gold", ex={}) => {
  const s = {
    gold:   {background:K.gold, color:"#080808", border:"none", fontWeight:600},
    outline:{background:"transparent", color:K.gold, border:`1px solid ${K.goldDim}`},
    ghost:  {background:"transparent", color:K.mutedLight, border:`1px solid ${K.border}`},
    danger: {background:K.dangerBg, color:K.danger, border:`1px solid ${K.dangerBorder}`},
    success:{background:K.successBg, color:K.success, border:`1px solid ${K.successBorder}`},
    flat:   {background:K.surfaceHigh, color:K.mutedLight, border:`1px solid ${K.borderMid}`},
  };
  return {...s[v], borderRadius:8, padding:"10px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit", transition:"opacity .15s", ...ex};
};
const Tag = (color, bg, border) => ({ background:bg, color, border:`1px solid ${border||bg}`, fontSize:11, fontWeight:500, padding:"3px 9px", borderRadius:20, display:"inline-block", whiteSpace:"nowrap" });

/* ─── DATI ─── */
const PIANI = [
  {id:"basic",   name:"Basic",    price:"Gratuito",    color:K.mutedLight, features:["Allenamenti effettuati","Sedute rimanenti","Dati BIA","Prenotazioni"]},
  {id:"prime",   name:"Prime",    price:"€7.99/mese",  color:"#9B8FFF",    features:["Tutto Basic","Deficit calorico","Consigli nutrizionali","AI BIA"]},
  {id:"platinum",name:"Platinum", price:"€14.99/mese", color:K.success,    features:["Tutto Prime","Piano dieta","Check-in"], popular:true},
  {id:"gold",    name:"Gold",     price:"€24.99/mese", color:K.gold,       features:["Tutto Platinum","Trainer dedicato","Sconto 10% rinnovi","Programma custom"]},
];
const PACK = ["EMS","Vacufit","Combinato EMS+Vacufit"];
const PACK_SED = {EMS:10, Vacufit:10, "Combinato EMS+Vacufit":20};

const INIT_CLIENTI = [
  {id:1, nome:"Marco", cognome:"Rossi", dataNascita:"1990-03-15", luogoNascita:"Milano", indirizzo:"Via Roma 12, Milano", telefono:"3391234567", email:"marco@email.it", note:"Preferisce mattina", pacchetto:"EMS", seduteTotal:10, seduteUsate:8, piano:"Gold", bia:{peso:81,altezza:178,eta:34,grassoPerc:20,massaMuscolare:62,bmi:24.1,obiettivo:"Dimagrimento",deficit:450}, biaPdf:null, anamnesePdf:null, cancellazioni:0},
  {id:2, nome:"Sara",  cognome:"Bianchi", dataNascita:"1995-07-22", luogoNascita:"Roma", indirizzo:"Via Verdi 5, Roma", telefono:"3487654321", email:"sara@email.it", note:"Allergia lattosio", pacchetto:"Vacufit", seduteTotal:10, seduteUsate:3, piano:"Platinum", bia:{peso:61,altezza:165,eta:29,grassoPerc:24,massaMuscolare:44,bmi:22.4,obiettivo:"Tonificazione",deficit:300}, biaPdf:null, anamnesePdf:null, cancellazioni:0},
  {id:3, nome:"Luca",  cognome:"Ferrari", dataNascita:"1988-11-05", luogoNascita:"Torino", indirizzo:"Corso Torino 88, Torino", telefono:"3201112233", email:"luca@email.it", note:"", pacchetto:"Combinato EMS+Vacufit", seduteTotal:20, seduteUsate:16, piano:"Basic", bia:{peso:88,altezza:182,eta:36,grassoPerc:28,massaMuscolare:60,bmi:26.6,obiettivo:"Dimagrimento",deficit:500}, biaPdf:null, anamnesePdf:null, cancellazioni:2},
  {id:4, nome:"Anna",  cognome:"Conti",   dataNascita:"1993-05-18", luogoNascita:"Napoli", indirizzo:"Via Napoli 3, Napoli", telefono:"3334455667", email:"anna@email.it", note:"Obiettivo dimagrimento", pacchetto:"EMS", seduteTotal:10, seduteUsate:6, piano:"Prime", bia:{peso:65,altezza:163,eta:31,grassoPerc:26,massaMuscolare:45,bmi:24.5,obiettivo:"Dimagrimento",deficit:350}, biaPdf:null, anamnesePdf:null, cancellazioni:3},
];
const INIT_FOLLOWUP = [
  {id:1,clienteId:1,dataContatto:"10/05/2026",motivo:"Rinnovo",esito:"Interessato",prossimaAzione:"Richiamare 18/05"},
  {id:2,clienteId:3,dataContatto:"08/05/2026",motivo:"Sedute in scadenza",esito:"In attesa",prossimaAzione:"WhatsApp follow-up"},
];
const INIT_PREN = [
  {id:1,userId:"user",data:"2026-05-19",ora:"09:00",tipo:"EMS",stato:"confermata",cancellazioni:0},
  {id:2,userId:"user",data:"2026-05-21",ora:"10:30",tipo:"Vacufit",stato:"confermata",cancellazioni:0},
];
const BIA_DATA = [{mese:"Gen",peso:88},{mese:"Feb",peso:86},{mese:"Mar",peso:84},{mese:"Apr",peso:83},{mese:"Mag",peso:81}];
const DIETA = [
  {pasto:"Colazione",items:["Avena con frutta","Caffè senza zucchero","2 uova strapazzate"]},
  {pasto:"Spuntino",items:["1 mela","30g mandorle"]},
  {pasto:"Pranzo",items:["150g pollo grigliato","200g riso basmati","Insalata mista"]},
  {pasto:"Merenda",items:["Yogurt greco 0%","Frutta secca"]},
  {pasto:"Cena",items:["200g salmone","Verdure al vapore","1 fetta pane integrale"]},
];

/* ─── ORARI ─── */
const genSlots = (maxH, maxM=0) => { const s=[]; for(let h=7;h<maxH;h++){s.push(`${String(h).padStart(2,"0")}:00`);s.push(`${String(h).padStart(2,"0")}:30`);} if(maxM>0)s.push(`${String(maxH).padStart(2,"0")}:00`); return s; };
const SLOTS_W = genSlots(20,30); const SLOTS_S = genSlots(13,30);
const getDaySlots = d => { const day=new Date(d).getDay(); return day===0?[]:day===6?SLOTS_S:SLOTS_W; };
const getNext14 = () => { const r=[],t=new Date(); for(let i=0;i<14;i++){const d=new Date(t);d.setDate(t.getDate()+i);if(d.getDay()!==0)r.push(d.toISOString().split("T")[0]);} return r; };
const fmtDate = s => new Date(s).toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"});
const fmtAge = d => { const b=new Date(d),n=new Date(); let a=n.getFullYear()-b.getFullYear(); if(n<new Date(n.getFullYear(),b.getMonth(),b.getDate()))a--; return a; };

/* ─── LOGO ─── */
const Logo = ({size=36}) => (
  <svg width={size} height={size*1.25} viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
    <g fill={K.gold}>
      {/* Elmo centrale - corpo principale */}
      <path d="M60 130 Q58 100 60 80 Q65 55 80 45 Q90 38 100 38 Q110 38 120 45 Q135 55 140 80 Q142 100 140 130 Q130 138 100 140 Q70 138 60 130Z"/>
      {/* Cresta rotonda in cima */}
      <ellipse cx="100" cy="44" rx="18" ry="14"/>
      {/* Corno sinistro - curva verso l'alto-sinistra */}
      <path d="M72 60 Q55 40 42 18 Q38 10 40 6 Q44 4 48 10 Q58 28 70 50 Q73 55 74 62Z"/>
      {/* Punta corno sinistro */}
      <path d="M40 6 Q36 2 38 8 Q40 14 44 18 Q42 12 40 6Z"/>
      {/* Corno destro - curva verso l'alto-destra */}
      <path d="M128 60 Q145 40 158 18 Q162 10 160 6 Q156 4 152 10 Q142 28 130 50 Q127 55 126 62Z"/>
      {/* Punta corno destro */}
      <path d="M160 6 Q164 2 162 8 Q160 14 156 18 Q158 12 160 6Z"/>
      {/* Spallina sinistra - scende in basso a sinistra */}
      <path d="M62 118 Q48 122 36 132 Q30 138 32 144 Q36 148 42 144 Q54 136 66 126Z"/>
      {/* Punta spallina sinistra */}
      <path d="M32 144 Q28 150 34 150 Q40 148 44 144 Q38 146 32 144Z"/>
      {/* Spallina destra - scende in basso a destra */}
      <path d="M138 118 Q152 122 164 132 Q170 138 168 144 Q164 148 158 144 Q146 136 134 126Z"/>
      {/* Punta spallina destra */}
      <path d="M168 144 Q172 150 166 150 Q160 148 156 144 Q162 146 168 144Z"/>
      {/* Scritta KENDO */}
      <text x="100" y="238" textAnchor="middle" fontSize="28" fontFamily="Georgia,serif" letterSpacing="6" fill={K.gold}>KENDO</text>
    </g>
  </svg>
);

/* ─── MAIN ─── */
export default function App() {
  const [screen,setScreen]=useState("login");
  const [role,setRole]=useState("user");
  const [tab,setTab]=useState("home");
  const [piano,setPiano]=useState("gold");
  const [clienti,setClienti]=useState(INIT_CLIENTI);
  const [followups,setFollowups]=useState(INIT_FOLLOWUP);
  const [pren,setPren]=useState(INIT_PREN);
  const [chk,setChk]=useState({diet:false,gym:false});

  const userNav=[{id:"home",icon:"○",label:"Home"},{id:"prenota",icon:"◷",label:"Prenota"},{id:"bia",icon:"◈",label:"BIA"},{id:"dieta",icon:"◉",label:"Dieta"},{id:"chat",icon:"◎",label:"AI"}];
  const adminNav=[{id:"home",icon:"◈",label:"Dashboard"},{id:"clienti",icon:"○",label:"Clienti"},{id:"agenda",icon:"◷",label:"Agenda"},{id:"followup",icon:"◉",label:"Follow-up"},{id:"chat",icon:"◎",label:"AI"}];
  const nav = role==="admin"?adminNav:userNav;
  const userBia = INIT_CLIENTI[0].bia;

  if(screen==="login") return <><style>{gs}</style><LoginScreen onLogin={(r,p)=>{setRole(r);if(p)setPiano(p);setScreen("app");setTab("home");}} onReg={()=>setScreen("reg")}/></>;
  if(screen==="reg") return <><style>{gs}</style><RegScreen onBack={()=>setScreen("login")} onDone={p=>{setPiano(p);setScreen("login");}}/></>;

  return (
    <>
      <style>{gs}</style>
      <div style={{maxWidth:390,margin:"0 auto",color:K.white,background:K.black,minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:"var(--font-sans)"}}>
        {/* Header */}
        <div style={{background:K.surface,borderBottom:`1px solid ${K.border}`,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Logo size={26}/>
            <div>
              <div style={{fontWeight:600,fontSize:15,color:K.gold,letterSpacing:3}}>KENDO</div>
              <div style={{fontSize:10,color:K.muted,letterSpacing:1}}>{role==="admin"?"ADMIN":"PIANO "+piano.toUpperCase()}</div>
            </div>
          </div>
          <button onClick={()=>setScreen("login")} style={B("ghost",{padding:"5px 12px",fontSize:11})}>Esci</button>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"14px 14px 80px"}}>
          {role==="admin"?(
            <>
              {tab==="home"    && <Dashboard clienti={clienti} followups={followups} pren={pren}/>}
              {tab==="clienti" && <Clienti clienti={clienti} setClienti={setClienti}/>}
              {tab==="agenda"  && <Agenda pren={pren} setPren={setPren} clienti={clienti}/>}
              {tab==="followup"&& <FollowUp clienti={clienti} followups={followups} setFollowups={setFollowups}/>}
              {tab==="chat"    && <ChatAI piano="gold" isAdmin bia={userBia}/>}
            </>
          ):(
            <>
              {tab==="home"    && <HomeUser piano={piano} pren={pren} chk={chk} setChk={setChk}/>}
              {tab==="prenota" && <Prenota piano={piano} pren={pren} setPren={setPren} clienti={clienti} setClienti={setClienti}/>}
              {tab==="bia"     && <BIATab/>}
              {tab==="dieta"   && <DietaTab piano={piano}/>}
              {tab==="chat"    && <ChatAI piano={piano} bia={userBia}/>}
            </>
          )}
        </div>

        {/* Nav */}
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:390,background:K.surface,borderTop:`1px solid ${K.border}`,display:"flex",justifyContent:"space-around",padding:"10px 0 12px"}}>
          {nav.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"0 8px"}}>
              <span style={{fontSize:16,color:tab===n.id?K.gold:K.muted}}>{n.icon}</span>
              <span style={{fontSize:10,color:tab===n.id?K.gold:K.muted,fontWeight:tab===n.id?600:400,letterSpacing:0.5}}>{n.label}</span>
              {tab===n.id&&<div style={{width:16,height:1.5,background:K.gold,borderRadius:2}}/>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── LOGIN ─── */
function LoginScreen({function LoginScreen({onLogin,onReg}) {
  const [isAdmin,setIsAdmin]=useState(false);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const handleLogin = async () => {
    if(!email||!password){setError("Inserisci email e password");return;}
    setLoading(true);setError("");
    try {
      const {data,error:err} = await supabase.auth.signInWithPassword({email,password});
      if(err){setError("Email o password non corretti");setLoading(false);return;}
      const {data:profile} = await supabase.from("profiles").select("is_admin,piano").eq("id",data.user.id).single();
      onLogin(isAdmin&&profile?.is_admin?"admin":"user", profile?.piano||"basic");
    } catch(e){setError("Errore di connessione");}
    setLoading(false);
  };

  return (
    <div style={{maxWidth:390,margin:"0 auto",padding:32,minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",background:K.black,fontFamily:"var(--font-sans)"}}>
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Logo size={72}/></div>
        <div style={{fontSize:12,color:K.muted,letterSpacing:2}}>FITNESS & WELLNESS</div>
      </div>
      {error&&<div style={{background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:K.danger,marginBottom:12}}>{error}</div>}
      <div style={C({marginBottom:12})}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:6,letterSpacing:1}}>EMAIL</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="la-tua@email.it" style={{marginBottom:14}}/>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:6,letterSpacing:1}}>PASSWORD</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••••••" style={{marginBottom:20}}/>
        <button onClick={handleLogin} disabled={loading} style={{...B("gold"),width:"100%",padding:13,fontSize:14,opacity:loading?0.7:1}}>
          {loading?"ACCESSO IN CORSO...":"ACCEDI"}
        </button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={()=>setIsAdmin(false)} style={{...B(isAdmin?"ghost":"outline"),flex:1,fontSize:12}}>Utente</button>
        <button onClick={()=>setIsAdmin(true)} style={{flex:1,background:isAdmin?"#0e0e1e":"transparent",color:isAdmin?"#9B8FFF":K.muted,border:`1px solid ${isAdmin?"#534AB7":K.border}`,borderRadius:8,padding:10,fontSize:12,cursor:"pointer"}}>Admin</button>
      </div>
      <div style={{textAlign:"center",fontSize:12,color:K.muted}}>Non hai un account? <button onClick={onReg} style={{background:"none",border:"none",color:K.gold,fontSize:12,cursor:"pointer"}}>Registrati</button></div>
    </div>
  );
}}) {
  const [isAdmin,setIsAdmin]=useState(false);
  return (
    <div style={{maxWidth:390,margin:"0 auto",padding:32,minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",background:K.black,fontFamily:"var(--font-sans)"}}>
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Logo size={72}/></div>
        <div style={{fontSize:12,color:K.muted,letterSpacing:2}}>FITNESS & WELLNESS</div>
      </div>
      <div style={C({marginBottom:12})}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:6,letterSpacing:1}}>EMAIL</label>
        <input defaultValue={isAdmin?"admin@kendo.it":"marco@email.it"} style={{marginBottom:14}}/>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:6,letterSpacing:1}}>PASSWORD</label>
        <input type="password" defaultValue="••••••••" style={{marginBottom:20}}/>
        <button onClick={()=>onLogin(isAdmin?"admin":"user")} style={{...B("gold"),width:"100%",padding:13,fontSize:14,letterSpacing:1}}>ACCEDI</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={()=>setIsAdmin(false)} style={{...B(isAdmin?"ghost":"outline"),flex:1,fontSize:12}}>Utente</button>
        <button onClick={()=>setIsAdmin(true)} style={{flex:1,background:isAdmin?"#0e0e1e":"transparent",color:isAdmin?"#9B8FFF":K.muted,border:`1px solid ${isAdmin?"#534AB7":K.border}`,borderRadius:8,padding:10,fontSize:12,cursor:"pointer"}}>Admin</button>
      </div>
      <div style={{textAlign:"center",fontSize:12,color:K.muted}}>Non hai un account? <button onClick={onReg} style={{background:"none",border:"none",color:K.gold,fontSize:12,cursor:"pointer"}}>Registrati</button></div>
    </div>
  );
}

/* ─── REGISTRAZIONE ─── */
function RegScreen({onBack,onDone}) {
  const [step,setStep]=useState(1);
  const [sel,setSel]=useState("platinum");
  const [f,setF]=useState({nome:"",cognome:"",email:"",password:"",peso:"",altezza:"",obiettivo:""});
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  if(step===1) return (
    <div style={{maxWidth:390,margin:"0 auto",padding:24,background:K.black,minHeight:"100vh",color:K.white,fontFamily:"var(--font-sans)"}}>
      <button onClick={onBack} style={B("ghost",{marginBottom:20,fontSize:12})}>← Indietro</button>
      <div style={{display:"flex",justifyContent:"center",marginBottom:20}}><Logo size={52}/></div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:4}}>Crea account</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:20}}>Unisciti a Kendo</div>
      {[["Nome","nome","text"],["Cognome","cognome","text"],["Email","email","email"],["Password","password","password"],["Peso (kg)","peso","number"],["Altezza (cm)","altezza","number"]].map(([l,k,t])=>(
        <div key={k} style={{marginBottom:12}}>
          <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>{l.toUpperCase()}</label>
          <input type={t} value={f[k]} onChange={e=>u(k,e.target.value)} placeholder={l}/>
        </div>
      ))}
      <div style={{marginBottom:20}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>OBIETTIVO</label>
        <select value={f.obiettivo} onChange={e=>u("obiettivo",e.target.value)}><option value="">Seleziona...</option><option>Dimagrimento</option><option>Massa muscolare</option><option>Tonificazione</option><option>Benessere</option></select>
      </div>
      <button onClick={()=>setStep(2)} style={{...B("gold"),width:"100%",padding:13,fontSize:14}}>Continua →</button>
    </div>
  );
  return (
    <div style={{maxWidth:390,margin:"0 auto",padding:24,background:K.black,minHeight:"100vh",color:K.white,fontFamily:"var(--font-sans)"}}>
      <button onClick={()=>setStep(1)} style={B("ghost",{marginBottom:20,fontSize:12})}>← Indietro</button>
      <div style={{fontSize:18,fontWeight:600,marginBottom:4}}>Scegli piano</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:20}}>Cambiabile in qualsiasi momento</div>
      {PIANI.map(p=>(
        <div key={p.id} onClick={()=>setSel(p.id)} style={C({cursor:"pointer",border:sel===p.id?`1px solid ${p.color}`:`1px solid ${K.border}`,position:"relative",padding:"14px"})}>
          {p.popular&&<span style={{...Tag("#fff",K.success),fontSize:9,position:"absolute",top:-9,right:12}}>PIÙ SCELTO</span>}
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontWeight:600,fontSize:14,color:p.color}}>{p.name}</span>
            <span style={{fontWeight:500,color:K.gold,fontSize:13}}>{p.price}</span>
          </div>
          {p.features.map(ff=><div key={ff} style={{fontSize:12,color:K.muted,marginBottom:3}}>· {ff}</div>)}
        </div>
      ))}
      <button onClick={()=>onDone(sel)} style={{...B("gold"),width:"100%",padding:13,fontSize:14,marginTop:4}}>Inizia con {PIANI.find(p=>p.id===sel)?.name}</button>
    </div>
  );
}

/* ─── HOME UTENTE ─── */
function HomeUser({piano,pren,chk,setChk}) {
  const p=PIANI.find(x=>x.id===piano);
  const prox=pren.filter(x=>x.userId==="user"&&x.data>=new Date().toISOString().split("T")[0]).sort((a,b)=>a.data.localeCompare(b.data)||a.ora.localeCompare(b.ora))[0];
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <StatBox label="Peso" value="81 kg" sub="−7 kg da gen" color="#9B8FFF"/>
        <StatBox label="Streak" value="12 gg" sub="record: 18" color={K.gold}/>
        <StatBox label="Sedute" value="2" sub="rimaste · rinnova!" color={K.danger}/>
        <StatBox label="Piano" value={p?.name} sub="attivo" color={p?.color}/>
      </div>
      {prox&&<div style={C({border:`1px solid ${K.goldBorder}`,background:K.goldBg,marginBottom:10})}>
        <div style={{fontSize:11,color:K.muted,marginBottom:4,letterSpacing:1}}>PROSSIMA SESSIONE</div>
        <div style={{fontWeight:600,fontSize:16,color:K.gold}}>{prox.tipo} — {prox.ora}</div>
        <div style={{fontSize:12,color:K.mutedMid,marginTop:3}}>{fmtDate(prox.data)} · 30 min</div>
      </div>}
      <div style={C()}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:12,letterSpacing:0.5}}>CHECK-IN OGGI</div>
        {[{k:"diet",label:"Ho seguito la dieta"},{k:"gym",label:"Ho fatto attività fisica"}].map(c=>(
          <div key={c.k} onClick={()=>setChk(p=>({...p,[c.k]:!p[c.k]}))} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${K.border}`,cursor:"pointer"}}>
            <div style={{width:22,height:22,borderRadius:6,background:chk[c.k]?K.gold:"transparent",border:`1px solid ${chk[c.k]?K.gold:K.borderMid}`,display:"flex",alignItems:"center",justifyContent:"center",color:"#080808",fontWeight:700,fontSize:12,flexShrink:0}}>{chk[c.k]&&"✓"}</div>
            <span style={{fontSize:13,color:chk[c.k]?K.gold:K.mutedLight,textDecoration:chk[c.k]?"line-through":"none"}}>{c.label}</span>
          </div>
        ))}
        <div style={{fontSize:11,color:K.muted,marginTop:10}}>{chk.diet&&chk.gym?"🏆 Ottimo lavoro oggi!":"Spunta le attività completate."}</div>
      </div>
    </div>
  );
}

/* ─── PRENOTA ─── */
function Prenota({piano, pren, setPren, clienti, setClienti}) {
  const days=getNext14();
  const [day,setDay]=useState(days[0]);
  const [tipo,setTipo]=useState("EMS");
  const [done,setDone]=useState(null);
  const slots=getDaySlots(day);
  const busy=pren.filter(p=>p.data===day&&p.tipo===tipo).map(p=>p.ora);
  const mine=pren.filter(p=>p.userId==="user").sort((a,b)=>a.data.localeCompare(b.data)||a.ora.localeCompare(b.ora));

  const prenota=(ora)=>{
    const n={id:Date.now(),userId:"user",data:day,ora,tipo,stato:"confermata",cancellazioni:0};
    setPren(p=>[...p,n]); setDone(n);
  };

  const cancella=(id)=>{
    const p=pren.find(x=>x.id===id);
    if(!p)return;
    const oggi=new Date().toISOString().split("T")[0];
    const mese=oggi.slice(0,7);
    const cancMese=pren.filter(x=>x.userId==="user"&&x.data.startsWith(mese)&&x.stato==="cancellata").length;
    const newCancMese=cancMese+1;
    let msg="";
    if(newCancMese>=3){
      // scala seduta
      setClienti(prev=>prev.map(c=>c.id===1?{...c,seduteUsate:Math.min(c.seduteUsate+1,c.seduteTotal)}:c));
      msg="Hai cancellato 3 appuntamenti questo mese. Ti è stata scalata 1 seduta.";
    }
    setPren(prev=>prev.map(x=>x.id===id?{...x,stato:"cancellata"}:x));
    if(msg)alert(msg);
  };

  if(done) return (
    <div style={{textAlign:"center",padding:"4rem 1.5rem"}}>
      <div style={{width:64,height:64,borderRadius:"50%",background:K.successBg,border:`1px solid ${K.success}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 20px"}}>✓</div>
      <div style={{fontWeight:600,fontSize:18,color:K.gold,marginBottom:8}}>Prenotazione confermata</div>
      <div style={{fontSize:14,color:K.mutedMid,marginBottom:4}}>{done.tipo} · {fmtDate(done.data)}</div>
      <div style={{fontSize:22,fontWeight:600,marginBottom:28,color:K.white}}>{done.ora}</div>
      <button onClick={()=>setDone(null)} style={{...B("gold"),width:"100%",padding:13}}>Torna alle prenotazioni</button>
    </div>
  );

  return (
    <div>
      <div style={{fontWeight:600,fontSize:16,marginBottom:2}}>Prenota sessione</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>30 min · Lun–Ven 7:00–20:30 · Sab 7:00–13:30</div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {["EMS","Vacufit"].map(t=>(
          <button key={t} onClick={()=>setTipo(t)} style={{...B(tipo===t?"gold":"ghost",{flex:1,fontSize:13})}}>
            {t==="EMS"?"⚡ EMS":"◎ Vacufit"}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:14}}>
        {days.map(d=>{const dd=new Date(d);const isSel=d===day;return(
          <div key={d} onClick={()=>setDay(d)} style={{flexShrink:0,background:isSel?K.goldBg:"#111",border:`1px solid ${isSel?K.gold:K.border}`,borderRadius:10,padding:"8px 10px",cursor:"pointer",textAlign:"center",minWidth:48}}>
            <div style={{fontSize:10,color:isSel?K.gold:K.muted}}>{dd.toLocaleDateString("it-IT",{weekday:"short"}).slice(0,3).toUpperCase()}</div>
            <div style={{fontSize:16,fontWeight:600,color:isSel?K.gold:K.white}}>{dd.getDate()}</div>
          </div>
        );})}
      </div>
      <div style={{fontSize:12,color:K.muted,marginBottom:10,letterSpacing:0.5}}>{fmtDate(day).toUpperCase()} — {tipo}</div>
      {slots.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Chiuso</div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:20}}>
          {slots.map(ora=>{const occ=busy.includes(ora);const mio=pren.some(p=>p.userId==="user"&&p.data===day&&p.ora===ora&&p.tipo===tipo&&p.stato==="confermata");return(
            <button key={ora} disabled={occ&&!mio} onClick={()=>!occ&&!mio&&prenota(ora)}
              style={{background:mio?K.successBg:occ?"#0e0e0e":K.goldBg,border:`1px solid ${mio?K.success:occ?K.border:K.goldBorder}`,borderRadius:8,padding:"9px 4px",cursor:occ&&!mio?"not-allowed":"pointer",fontSize:12,fontWeight:500,color:mio?K.success:occ?K.muted:K.gold,opacity:occ&&!mio?0.4:1}}>
              {ora}
            </button>
          );})}
        </div>
      )}
      {mine.filter(p=>p.stato==="confermata").length>0&&(
        <>
          <div style={{fontWeight:600,fontSize:13,marginBottom:10,letterSpacing:0.5}}>LE MIE PRENOTAZIONI</div>
          {mine.filter(p=>p.stato==="confermata").map(p=>(
            <div key={p.id} style={C()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:500,color:K.gold}}>{p.tipo} · {p.ora}</div><div style={{fontSize:12,color:K.muted,marginTop:2}}>{fmtDate(p.data)}</div></div>
                <button onClick={()=>cancella(p.id)} style={B("danger",{padding:"6px 12px",fontSize:12})}>Cancella</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ─── BIA ─── */
function BIATab() {
  const max=88,min=79;
  return (
    <div>
      <div style={{fontWeight:600,fontSize:16,marginBottom:14}}>BIA — Progressi</div>
      <div style={C()}>
        <div style={{fontSize:11,color:K.muted,marginBottom:14,letterSpacing:1}}>ANDAMENTO PESO (KG)</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100,marginBottom:8}}>
          {BIA_DATA.map((d,i)=>{const h=((d.peso-min)/(max-min))*70+20;const last=i===BIA_DATA.length-1;return(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:10,color:last?K.gold:K.muted,fontWeight:last?600:400}}>{d.peso}</div>
              <div style={{width:"100%",height:h,background:last?K.gold:"#1e1800",borderRadius:"3px 3px 0 0",border:last?"none":`1px solid ${K.goldBorder}`}}/>
              <div style={{fontSize:9,color:K.muted}}>{d.mese}</div>
            </div>
          );})}
        </div>
        <div style={{fontSize:12,color:K.muted}}>Totale: <span style={{color:K.gold,fontWeight:600}}>−7 kg</span> da gennaio</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[{l:"Peso",v:"81 kg",d:"−7 kg"},{l:"Massa grassa",v:"20%",d:"−4%"},{l:"Massa muscolare",v:"62 kg",d:"+3 kg"},{l:"BMI",v:"24.1",d:"−2.1"}].map(m=>(
          <div key={m.l} style={C({marginBottom:0})}>
            <div style={{fontSize:11,color:K.muted,marginBottom:4,letterSpacing:1}}>{m.l.toUpperCase()}</div>
            <div style={{fontSize:18,fontWeight:600}}>{m.v}</div>
            <div style={{fontSize:11,color:K.gold,marginTop:2}}>{m.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── DIETA ─── */
function DietaTab({piano}) {
  const [chk,setChk]=useState({});
  const locked=piano==="basic";
  return (
    <div>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>Piano alimentare</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:12}}>Piano {PIANI.find(p=>p.id===piano)?.name}</div>
      {["prime","platinum","gold"].includes(piano)&&(
        <div style={C({border:`1px solid ${K.goldBorder}`,background:K.goldBg,marginBottom:12})}>
          <div style={{fontSize:11,color:K.gold,letterSpacing:1,marginBottom:4}}>DEFICIT CALORICO TARGET</div>
          <div style={{fontSize:22,fontWeight:600}}>−450 kcal/giorno</div>
          <div style={{fontSize:12,color:K.muted,marginTop:2}}>Obiettivo: −0.5 kg/settimana</div>
        </div>
      )}
      {locked?(
        <div style={C({textAlign:"center",padding:"2.5rem"})}>
          <div style={{fontSize:28,marginBottom:12}}>🔒</div>
          <div style={{fontWeight:600,marginBottom:6}}>Non disponibile nel piano Basic</div>
          <div style={{fontSize:12,color:K.muted,marginBottom:16}}>Aggiorna al piano Prime o superiore.</div>
          <button style={B("outline",{fontSize:12})}>Aggiorna piano →</button>
        </div>
      ):DIETA.map((d,i)=>(
        <div key={i} style={C()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontWeight:500,fontSize:13}}>{d.pasto}</span>
            <div onClick={()=>setChk(p=>({...p,[d.pasto]:!p[d.pasto]}))} style={{width:22,height:22,borderRadius:6,background:chk[d.pasto]?K.gold:"transparent",border:`1px solid ${chk[d.pasto]?K.gold:K.borderMid}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#080808",fontWeight:700,fontSize:11}}>{chk[d.pasto]&&"✓"}</div>
          </div>
          {d.items.map(it=><div key={it} style={{fontSize:12,color:K.muted,marginBottom:3}}>· {it}</div>)}
        </div>
      ))}
    </div>
  );
}

/* ─── CHAT AI ─── */
function ChatAI({piano, isAdmin, bia}) {
  const pName=PIANI.find(p=>p.id===piano)?.name||piano;
  const bioStr=bia?`Dati BIA utente: peso ${bia.peso}kg, altezza ${bia.altezza}cm, età ${bia.eta}aa, massa grassa ${bia.grassoPerc}%, massa muscolare ${bia.massaMuscolare}kg, BMI ${bia.bmi}, obiettivo: ${bia.obiettivo}, deficit target: ${bia.deficit} kcal/gg.`:"";
  const sys = isAdmin
    ? `Sei l'assistente gestionale Kendo. Aiuta l'admin con gestione clienti EMS/Vacufit, retention, rinnovi, follow-up, agenda. Italiano, professionale, conciso.`
    : {
        basic:`Sei l'AI Kendo per piano Basic. Parla solo di: sedute rimanenti, dati BIA base. Per funzioni avanzate invita all'upgrade. ${bioStr}`,
        prime:`Sei l'AI Kendo per piano Prime. Analizza BIA, dai consigli su deficit calorico e nutrizione generale. ${bioStr}`,
        platinum:`Sei l'AI Kendo per piano Platinum. Analizza BIA in dettaglio, suggerisci piani dieta e allenamento settimanale. Sii specifico e pratico. ${bioStr}`,
        gold:`Sei il coach AI personale Kendo per piano Gold. Hai accesso completo: analizza BIA in profondità, crea piani personalizzati, dai consigli da personal trainer esperto. Sii diretto, motivante e preciso. ${bioStr}`,
      }[piano]||"";

  const qs = isAdmin
    ? ["Clienti a rischio abbandono","Ottimizzare agenda","Template messaggio rinnovo"]
    : piano==="basic"
    ? ["Cosa dicono i miei dati BIA?","Quante sedute ho rimaste?"]
    : ["Analizza la mia BIA","Come migliorare composizione corporea?","Deficit calorico ottimale","Consigli post-EMS"];

  const [msgs,setMsgs]=useState([{role:"assistant",text:`Ciao! Sono il tuo assistente Kendo${isAdmin?" Admin":` — Piano ${pName}`}.${bia&&!isAdmin?" Ho accesso ai tuoi dati BIA e posso darti consigli personalizzati.":""} Come posso aiutarti?`}]);
  const [inp,setInp]=useState("");
  const [load,setLoad]=useState(false);
  const ref=useRef();
  useEffect(()=>ref.current?.scrollIntoView({behavior:"smooth"}),[msgs]);

  const send=async()=>{
    if(!inp.trim()||load)return;
    const txt=inp.trim();setInp("");setLoad(true);
    setMsgs(p=>[...p,{role:"user",text:txt}]);
    try{
      const hist=msgs.map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.text}));
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:sys,messages:[...hist,{role:"user",content:txt}]})});
      const data=await res.json();
      setMsgs(p=>[...p,{role:"assistant",text:data.content?.map(b=>b.text||"").join("")||"Errore."}]);
    }catch{setMsgs(p=>[...p,{role:"assistant",text:"Errore di connessione."}]);}
    setLoad(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 160px)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <Logo size={20}/>
        <div>
          <div style={{fontWeight:600,fontSize:14}}>Kendo AI</div>
          <div style={{fontSize:11,color:K.muted}}>{isAdmin?"Admin":"Piano "+pName} · Claude</div>
        </div>
      </div>
      {msgs.length===1&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {qs.map(q=><button key={q} onClick={()=>setInp(q)} style={B("flat",{fontSize:11,padding:"6px 10px",borderRadius:16})}>{q}</button>)}
        </div>
      )}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,paddingBottom:8}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"85%",background:m.role==="user"?K.goldBg:K.card,border:`1px solid ${m.role==="user"?K.goldBorder:K.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:m.role==="user"?K.gold:K.white,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.text}</div>
          </div>
        ))}
        {load&&<div style={{display:"flex"}}><div style={{background:K.card,border:`1px solid ${K.border}`,borderRadius:10,padding:"10px 14px",display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:K.gold,animation:`p 1.2s ${i*0.2}s infinite`}}/>)}</div></div>}
        <div ref={ref}/>
      </div>
      <div style={{display:"flex",gap:8,paddingTop:10,borderTop:`1px solid ${K.border}`}}>
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Scrivi un messaggio..."/>
        <button onClick={send} disabled={load} style={{...B("gold",{borderRadius:"50%",width:40,height:40,padding:0,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0})}}>↑</button>
      </div>
      <style>{`@keyframes p{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
    </div>
  );
}

/* ─── DASHBOARD ADMIN ─── */
function Dashboard({clienti, followups, pren}) {
  const oggi=new Date().toISOString().split("T")[0];
  const attivi=clienti.filter(c=>c.seduteUsate<c.seduteTotal).length;
  const quasi5=clienti.filter(c=>c.seduteTotal-c.seduteUsate<=5);
  const quasi3=clienti.filter(c=>c.seduteTotal-c.seduteUsate<=3);
  const canc3=clienti.filter(c=>c.cancellazioni>=3);
  const oggiPren=pren.filter(p=>p.data===oggi).length;

  const msgBia=(c)=>`https://wa.me/39${c.telefono}?text=${encodeURIComponent(`Ciao ${c.nome}! 👋 Ti ricordiamo che hai ancora sessioni disponibili con noi. Ti invitiamo a fissare un appuntamento per la tua BIA così da monitorare i tuoi progressi. Contattaci per prenotare! 💪 — Team Kendo`)}`;
  const msgRinnovo=(c)=>`https://wa.me/39${c.telefono}?text=${encodeURIComponent(`Ciao ${c.nome}! 🏆 Ti avvisiamo che ti mancano solo 3 sedute. Puoi rinnovare il tuo pacchetto direttamente in palestra con uno sconto riservato a te! Non perdere questa opportunità. Ti aspettiamo! — Team Kendo`)}`;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><Logo size={22}/><span style={{fontWeight:600,fontSize:16,color:K.gold,letterSpacing:1}}>DASHBOARD</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        <StatBox label="Clienti attivi" value={attivi} sub="con sedute"/>
        <StatBox label="Sessioni oggi" value={oggiPren} sub="prenotate" color="#9B8FFF"/>
        <StatBox label="< 5 sedute" value={quasi5.length} sub="da ricontattare" color={K.gold}/>
        <StatBox label="Follow-up" value={followups.length} sub="aperti" color={K.mutedMid}/>
      </div>

      {/* Clienti < 5 sedute → BIA */}
      {quasi5.length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:8}}>⚠️ MENO DI 5 SEDUTE — INVIA BIA</div>
          {quasi5.map(c=>{const res=c.seduteTotal-c.seduteUsate;return(
            <div key={c.id} style={C({border:`1px solid ${K.goldBorder}`,background:K.goldBg})}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:500,fontSize:14}}>{c.nome} {c.cognome}</div>
                  <div style={{fontSize:12,color:K.muted}}>{c.pacchetto} · {res} sed. rimaste</div>
                </div>
                <a href={msgBia(c)} target="_blank" rel="noreferrer" style={{...B("success",{padding:"7px 12px",fontSize:12,textDecoration:"none"})}}>📲 BIA</a>
              </div>
            </div>
          );})}
        </div>
      )}

      {/* Clienti ≤ 3 sedute → Rinnovo */}
      {quasi3.length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:K.danger,letterSpacing:1,marginBottom:8}}>🔴 MENO DI 3 SEDUTE — RINNOVO</div>
          {quasi3.map(c=>{const res=c.seduteTotal-c.seduteUsate;return(
            <div key={c.id} style={C({border:`1px solid ${K.dangerBorder}`,background:K.dangerBg})}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:500,fontSize:14}}>{c.nome} {c.cognome}</div>
                  <div style={{fontSize:12,color:K.muted}}>{res} sedute rimaste</div>
                </div>
                <a href={msgRinnovo(c)} target="_blank" rel="noreferrer" style={{...B("danger",{padding:"7px 12px",fontSize:12,textDecoration:"none"})}}>💬 Rinnovo</a>
              </div>
            </div>
          );})}
        </div>
      )}

      {/* 3 cancellazioni */}
      {canc3.length>0&&(
        <div>
          <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:8}}>⚡ 3 CANCELLAZIONI — SEDUTA SCALATA</div>
          {canc3.map(c=>(
            <div key={c.id} style={C()}>
              <div style={{fontWeight:500,fontSize:14}}>{c.nome} {c.cognome}</div>
              <div style={{fontSize:12,color:K.danger,marginTop:2}}>Cancellazioni questo mese: {c.cancellazioni} — seduta decurtata</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── CLIENTI ADMIN ─── */
function Clienti({clienti, setClienti}) {
  const [sel,setSel]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [editMode,setEditMode]=useState(false);
  const emptyF={nome:"",cognome:"",dataNascita:"",luogoNascita:"",indirizzo:"",telefono:"",email:"",note:"",pacchetto:"EMS"};
  const [f,setF]=useState(emptyF);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const [biaNome,setBiaNome]=useState("");
  const [anamNome,setAnamNome]=useState("");

  const aggiungi=()=>{
    const n={id:Date.now(),...f,seduteTotal:PACK_SED[f.pacchetto],seduteUsate:0,piano:"Basic",bia:{peso:0,altezza:0,eta:fmtAge(f.dataNascita)||0,grassoPerc:0,massaMuscolare:0,bmi:0,obiettivo:"",deficit:0},biaPdf:biaNome||null,anamnesePdf:anamNome||null,cancellazioni:0};
    setClienti(p=>[...p,n]);setF(emptyF);setBiaNome("");setAnamNome("");setShowAdd(false);
  };
  const salvaModifica=()=>{
    setClienti(p=>p.map(c=>c.id===sel?{...c,...f,biaPdf:biaNome||c.biaPdf,anamnesePdf:anamNome||c.anamnesePdf}:c));
    setEditMode(false);
  };
  const eliminaCliente=id=>{setClienti(p=>p.filter(c=>c.id!==id));setSel(null);};
  const segnaSeduta=id=>setClienti(p=>p.map(c=>c.id===id?{...c,seduteUsate:Math.min(c.seduteUsate+1,c.seduteTotal)}:c));

  // Form condiviso (nuovo o modifica)
  const FormCliente = ({titolo, onSalva, onAnnulla}) => (
    <div>
      <button onClick={onAnnulla} style={B("ghost",{marginBottom:20,fontSize:12})}>← Indietro</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>{titolo}</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:16}}>Dati anagrafici</div>
      {[["Nome","nome","text"],["Cognome","cognome","text"],["Data di nascita","dataNascita","date"],["Luogo di nascita","luogoNascita","text"],["Indirizzo di residenza","indirizzo","text"],["Telefono","telefono","tel"],["Email","email","email"]].map(([l,k,t])=>(
        <div key={k} style={{marginBottom:12}}>
          <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>{l.toUpperCase()}</label>
          <input type={t} value={f[k]} onChange={e=>u(k,e.target.value)} placeholder={l}/>
        </div>
      ))}
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>PACCHETTO</label>
        <select value={f.pacchetto} onChange={e=>u("pacchetto",e.target.value)}>{PACK.map(p=><option key={p}>{p}</option>)}</select>
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>NOTE</label>
        <textarea value={f.note} onChange={e=>u("note",e.target.value)} rows={2} placeholder="Note..."/>
      </div>
      <div style={C({marginBottom:16})}>
        <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:10}}>DOCUMENTI PDF</div>
        {[["PDF BIA",biaNome,setBiaNome],["PDF Anamnesi",anamNome,setAnamNome]].map(([l,nome,setNome])=>(
          <div key={l} style={{marginBottom:10}}>
            <div style={{fontSize:12,color:K.mutedLight,marginBottom:6}}>{l}</div>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:"#0e0e0e",border:`1px solid ${nome?K.gold:K.border}`,borderRadius:8,padding:"10px 12px"}}>
              <span style={{fontSize:14}}>{nome?"📄":"📎"}</span>
              <span style={{fontSize:12,color:nome?K.gold:K.muted,flex:1}}>{nome||"Carica "+l}</span>
              <input type="file" accept=".pdf" style={{display:"none"}} onChange={e=>e.target.files[0]&&setNome(e.target.files[0].name)}/>
            </label>
            {nome&&<div style={{fontSize:11,color:K.success,marginTop:4}}>✓ {nome}</div>}
          </div>
        ))}
      </div>
      <button onClick={onSalva} style={{...B("gold"),width:"100%",padding:13,fontSize:14}}>{titolo.includes("Modifica")?"Salva modifiche":"Aggiungi cliente"}</button>
    </div>
  );

  if(showAdd) return <FormCliente titolo="Nuova anagrafica" onSalva={aggiungi} onAnnulla={()=>setShowAdd(false)}/>;

  if(editMode && sel) {
    const c=clienti.find(x=>x.id===sel);
    return <FormCliente titolo="Modifica anagrafica" onSalva={salvaModifica} onAnnulla={()=>setEditMode(false)}/>;
  }

  if(sel) {
    const c=clienti.find(x=>x.id===sel);
    const res=c.seduteTotal-c.seduteUsate;
    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <button onClick={()=>setSel(null)} style={B("ghost",{fontSize:12})}>← Clienti</button>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setF({nome:c.nome,cognome:c.cognome,dataNascita:c.dataNascita,luogoNascita:c.luogoNascita,indirizzo:c.indirizzo,telefono:c.telefono,email:c.email,note:c.note,pacchetto:c.pacchetto});setBiaNome(c.biaPdf||"");setAnamNome(c.anamnesePdf||"");setEditMode(true);}} style={B("outline",{padding:"7px 14px",fontSize:12})}>✏️ Modifica</button>
            <button onClick={()=>eliminaCliente(c.id)} style={B("danger",{padding:"7px 14px",fontSize:12})}>🗑 Elimina</button>
          </div>
        </div>
        <div style={C()}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:K.gold}}>
              {c.nome[0]}{c.cognome[0]}
            </div>
            <div>
              <div style={{fontWeight:600,fontSize:16}}>{c.nome} {c.cognome}</div>
              <div style={{fontSize:12,color:K.muted,marginTop:1}}>{c.pacchetto} · Piano {c.piano}</div>
            </div>
          </div>
          <div style={{borderTop:`1px solid ${K.border}`,paddingTop:12,display:"flex",flexDirection:"column",gap:8}}>
            {[["Data di nascita",c.dataNascita?new Date(c.dataNascita).toLocaleDateString("it-IT")+" ("+fmtAge(c.dataNascita)+" anni)":"—"],["Luogo di nascita",c.luogoNascita||"—"],["Indirizzo",c.indirizzo||"—"],["Telefono",c.telefono],["Email",c.email],["Note",c.note||"—"]].map(([l,v])=>(
              <div key={l} style={{fontSize:13}}><span style={{color:K.muted}}>{l}: </span><span style={{color:K.white}}>{v}</span></div>
            ))}
          </div>
        </div>
        {/* BIA */}
        {c.bia.peso>0&&(
          <div style={C()}>
            <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:10}}>DATI BIA</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[["Peso",c.bia.peso+" kg"],["Altezza",c.bia.altezza+" cm"],["Massa grassa",c.bia.grassoPerc+"%"],["Massa muscolare",c.bia.massaMuscolare+" kg"],["BMI",c.bia.bmi],["Obiettivo",c.bia.obiettivo]].map(([l,v])=>(
                <div key={l} style={{background:K.surface,borderRadius:8,padding:"10px"}}>
                  <div style={{fontSize:10,color:K.muted,marginBottom:3}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:500,color:K.gold}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Documenti */}
        <div style={C()}>
          <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:10}}>DOCUMENTI</div>
          {[["BIA",c.biaPdf],["Anamnesi",c.anamnesePdf]].map(([l,nome])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:13,color:K.mutedLight}}>{l}</span>
              {nome?<span style={{...Tag(K.success,K.successBg),fontSize:11}}>📄 {nome}</span>:<span style={{...Tag(K.muted,K.surface),fontSize:11}}>Non caricato</span>}
            </div>
          ))}
        </div>
        {/* Sedute */}
        <div style={C()}>
          <div style={{fontWeight:500,marginBottom:10,fontSize:13}}>SEDUTE</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{flex:1,height:4,background:"#1a1a1a",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${(c.seduteUsate/c.seduteTotal)*100}%`,background:res<=3?K.danger:K.gold,borderRadius:2}}/></div>
            <span style={{fontSize:13,color:res<=3?K.danger:K.gold,fontWeight:600}}>{c.seduteUsate}/{c.seduteTotal}</span>
          </div>
          {c.cancellazioni>=3&&<div style={{fontSize:12,color:K.danger,marginBottom:8}}>⚡ 3 cancellazioni — 1 seduta scalata automaticamente</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>segnaSeduta(c.id)} disabled={res===0} style={{...B("gold",{flex:1,padding:"10px",fontSize:13})}}>+ Segna seduta</button>
            <a href={`https://wa.me/39${c.telefono}`} target="_blank" rel="noreferrer" style={{...B("success",{padding:"10px 14px",fontSize:13,textDecoration:"none",display:"flex",alignItems:"center"})}}>WhatsApp</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:600,fontSize:16}}>Clienti ({clienti.length})</div>
        <button onClick={()=>setShowAdd(true)} style={B("gold",{padding:"8px 14px",fontSize:12})}>+ Nuovo</button>
      </div>
      {clienti.map(c=>{const res=c.seduteTotal-c.seduteUsate;return(
        <div key={c.id} style={C({cursor:"pointer"})} onClick={()=>setSel(c.id)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:K.gold,flexShrink:0}}>{c.nome[0]}{c.cognome[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:500,fontSize:14}}>{c.nome} {c.cognome}</div>
              <div style={{fontSize:11,color:K.muted,marginTop:2}}>{c.pacchetto} · {c.email}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              <span style={Tag(res<=3?K.danger:K.gold,res<=3?K.dangerBg:K.goldBg,res<=3?K.dangerBorder:K.goldBorder)}>{res} sed.</span>
              {c.cancellazioni>=3&&<span style={Tag(K.danger,K.dangerBg)}>3 canc.</span>}
            </div>
          </div>
        </div>
      );})}
    </div>
  );
}

/* ─── AGENDA ADMIN ─── */
function Agenda({pren, setPren, clienti}) {
  const days=getNext14();
  const [day,setDay]=useState(days[0]);
  const dayP=pren.filter(p=>p.data===day&&p.stato==="confermata").sort((a,b)=>a.ora.localeCompare(b.ora));
  return (
    <div>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>Agenda</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>Tutte le sessioni</div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:14}}>
        {days.map(d=>{const dd=new Date(d);const isSel=d===day;const cnt=pren.filter(p=>p.data===d&&p.stato==="confermata").length;return(
          <div key={d} onClick={()=>setDay(d)} style={{flexShrink:0,background:isSel?K.goldBg:"#111",border:`1px solid ${isSel?K.gold:K.border}`,borderRadius:10,padding:"8px 10px",cursor:"pointer",textAlign:"center",minWidth:48}}>
            <div style={{fontSize:9,color:isSel?K.gold:K.muted}}>{dd.toLocaleDateString("it-IT",{weekday:"short"}).slice(0,3).toUpperCase()}</div>
            <div style={{fontSize:16,fontWeight:600,color:isSel?K.gold:K.white}}>{dd.getDate()}</div>
            {cnt>0&&<div style={{width:5,height:5,borderRadius:"50%",background:K.gold,margin:"2px auto 0"}}/>}
          </div>
        );})}
      </div>
      <div style={{fontSize:11,color:K.muted,marginBottom:10,letterSpacing:0.5}}>{fmtDate(day).toUpperCase()} — {dayP.length} SESSIONI</div>
      {dayP.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted,fontSize:13})}>Nessuna prenotazione</div>:
        dayP.map(p=>(
          <div key={p.id} style={C()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontWeight:600,fontSize:15,color:K.gold}}>{p.ora}</span>
                  <span style={Tag(p.tipo==="EMS"?"#6BBEFC":"#B88EFF",p.tipo==="EMS"?"#08101e":"#100e1e")}>{p.tipo}</span>
                </div>
                <div style={{fontSize:13,color:K.mutedLight}}>{p.userId==="user"?"Marco Rossi":"Cliente"}</div>
              </div>
              <button onClick={()=>setPren(prev=>prev.map(x=>x.id===p.id?{...x,stato:"cancellata"}:x))} style={B("danger",{padding:"6px 10px",fontSize:12})}>✕</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

/* ─── FOLLOWUP ADMIN ─── */
function FollowUp({clienti, followups, setFollowups}) {
  const [showAdd,setShowAdd]=useState(false);
  const [f,setF]=useState({clienteId:"",dataContatto:"",motivo:"",esito:"",prossimaAzione:""});
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const aggiungi=()=>{setFollowups(p=>[...p,{id:Date.now(),...f,clienteId:parseInt(f.clienteId)}]);setF({clienteId:"",dataContatto:"",motivo:"",esito:"",prossimaAzione:""});setShowAdd(false);};
  if(showAdd) return (
    <div>
      <button onClick={()=>setShowAdd(false)} style={B("ghost",{marginBottom:20,fontSize:12})}>← Indietro</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:16}}>Nuovo follow-up</div>
      <div style={{marginBottom:12}}><label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>CLIENTE</label><select value={f.clienteId} onChange={e=>u("clienteId",e.target.value)}><option value="">Seleziona...</option>{clienti.map(c=><option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>)}</select></div>
      {[["Data contatto","dataContatto","es. 17/05/2026"],["Motivo","motivo","es. Rinnovo"],["Esito","esito","es. Interessato"],["Prossima azione","prossimaAzione","es. Richiamare 20/05"]].map(([l,k,ph])=>(
        <div key={k} style={{marginBottom:12}}><label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>{l.toUpperCase()}</label><input value={f[k]} onChange={e=>u(k,e.target.value)} placeholder={ph}/></div>
      ))}
      <button onClick={aggiungi} style={{...B("gold"),width:"100%",padding:13,fontSize:14}}>Aggiungi</button>
    </div>
  );
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:600,fontSize:16}}>Follow-up ({followups.length})</div>
        <button onClick={()=>setShowAdd(true)} style={B("gold",{padding:"8px 14px",fontSize:12})}>+ Nuovo</button>
      </div>
      {followups.map(f=>{const cl=clienti.find(c=>c.id===f.clienteId);return(
        <div key={f.id} style={C()}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div><div style={{fontWeight:500}}>{cl?`${cl.nome} ${cl.cognome}`:"—"}</div><div style={{fontSize:11,color:K.muted,marginTop:2}}>{f.dataContatto}</div></div>
            <button onClick={()=>setFollowups(p=>p.filter(x=>x.id!==f.id))} style={{background:"none",border:"none",color:K.muted,cursor:"pointer",fontSize:14}}>✕</button>
          </div>
          {[["Motivo",f.motivo],["Esito",f.esito],["Prossima azione",f.prossimaAzione]].map(([l,v])=>(
            <div key={l} style={{fontSize:12,marginBottom:3}}><span style={{color:K.muted}}>{l}: </span><span style={{color:K.white}}>{v}</span></div>
          ))}
          {cl&&<a href={`https://wa.me/39${cl.telefono}`} target="_blank" rel="noreferrer" style={{...B("success",{display:"inline-block",marginTop:10,padding:"7px 12px",fontSize:12,textDecoration:"none"})}}>💬 WhatsApp</a>}
        </div>
      );})}
    </div>
  );
}

/* ─── STATBOX ─── */
function StatBox({label,value,sub,color}) {
  return (
    <div style={{background:K.card,border:`1px solid ${K.border}`,borderRadius:12,padding:"14px 12px"}}>
      <div style={{fontSize:10,color:K.muted,marginBottom:6,letterSpacing:1}}>{label.toUpperCase()}</div>
      <div style={{fontSize:20,fontWeight:600,color:color||K.gold}}>{value}</div>
      <div style={{fontSize:11,color:K.muted,marginTop:2}}>{sub}</div>
    </div>
  );
}