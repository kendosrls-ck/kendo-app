import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

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

/* ─── DATI STATICI ─── */
const PIANI = [
  {id:"basic",   name:"Basic",    price:"Gratuito",    color:K.mutedLight, features:["Allenamenti effettuati","Sedute rimanenti","Dati BIA","Prenotazioni"]},
  {id:"prime",   name:"Prime",    price:"€7.99/mese",  color:"#9B8FFF",    features:["Tutto Basic","Deficit calorico","Consigli nutrizionali","AI BIA"]},
  {id:"platinum",name:"Platinum", price:"€14.99/mese", color:K.success,    features:["Tutto Prime","Piano dieta","Check-in"], popular:true},
  {id:"gold",    name:"Gold",     price:"€24.99/mese", color:K.gold,       features:["Tutto Platinum","Trainer dedicato","Sconto 10% rinnovi","Programma custom"]},
];
const PACK = ["EMS","Vacufit","Combinato EMS+Vacufit"];
const PACK_SED = {EMS:10, Vacufit:10, "Combinato EMS+Vacufit":20};
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
      <path d="M60 130 Q58 100 60 80 Q65 55 80 45 Q90 38 100 38 Q110 38 120 45 Q135 55 140 80 Q142 100 140 130 Q130 138 100 140 Q70 138 60 130Z"/>
      <ellipse cx="100" cy="44" rx="18" ry="14"/>
      <path d="M72 60 Q55 40 42 18 Q38 10 40 6 Q44 4 48 10 Q58 28 70 50 Q73 55 74 62Z"/>
      <path d="M40 6 Q36 2 38 8 Q40 14 44 18 Q42 12 40 6Z"/>
      <path d="M128 60 Q145 40 158 18 Q162 10 160 6 Q156 4 152 10 Q142 28 130 50 Q127 55 126 62Z"/>
      <path d="M160 6 Q164 2 162 8 Q160 14 156 18 Q158 12 160 6Z"/>
      <path d="M62 118 Q48 122 36 132 Q30 138 32 144 Q36 148 42 144 Q54 136 66 126Z"/>
      <path d="M32 144 Q28 150 34 150 Q40 148 44 144 Q38 146 32 144Z"/>
      <path d="M138 118 Q152 122 164 132 Q170 138 168 144 Q164 148 158 144 Q146 136 134 126Z"/>
      <path d="M168 144 Q172 150 166 150 Q160 148 156 144 Q162 146 168 144Z"/>
      <text x="100" y="238" textAnchor="middle" fontSize="28" fontFamily="Georgia,serif" letterSpacing="6" fill={K.gold}>KENDO</text>
    </g>
  </svg>
);

/* ─── SPINNER ─── */
const Spinner = () => (
  <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"40vh"}}>
    <div style={{width:32,height:32,border:`3px solid ${K.border}`,borderTop:`3px solid ${K.gold}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

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

/* ─── MAIN APP ─── */
export default function App() {
  const [screen,setScreen]=useState("login");
  const [role,setRole]=useState("user");
  const [tab,setTab]=useState("home");
  const [piano,setPiano]=useState("basic");
  const [currentUser,setCurrentUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [chk,setChk]=useState({diet:false,gym:false});

  const userNav=[{id:"home",icon:"○",label:"Home"},{id:"prenota",icon:"◷",label:"Prenota"},{id:"bia",icon:"◈",label:"BIA"},{id:"dieta",icon:"◉",label:"Dieta"},{id:"chat",icon:"◎",label:"AI"}];
  const adminNav=[{id:"home",icon:"◈",label:"Dashboard"},{id:"clienti",icon:"○",label:"Clienti"},{id:"agenda",icon:"◷",label:"Agenda"},{id:"followup",icon:"◉",label:"Follow-up"},{id:"chat",icon:"◎",label:"AI"}];
  const nav = role==="admin"?adminNav:userNav;

  const handleLogin = (r, prof, user) => {
    setRole(r);
    setProfile(prof);
    setCurrentUser(user);
    setPiano(prof?.piano||"basic");
    setScreen("app");
    setTab("home");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setScreen("login");
    setRole("user");
    setProfile(null);
    setCurrentUser(null);
  };

  if(screen==="login") return <><style>{gs}</style><LoginScreen onLogin={handleLogin} onReg={()=>setScreen("reg")} onAdminReg={()=>setScreen("adminreg")}/></>;
  if(screen==="reg")   return <><style>{gs}</style><RegScreen onBack={()=>setScreen("login")} onDone={()=>setScreen("login")}/></>;
  if(screen==="adminreg") return <><style>{gs}</style><AdminRegScreen onBack={()=>setScreen("login")} onDone={()=>setScreen("login")}/></>;

  return (
    <>
      <style>{gs}</style>
      <div style={{maxWidth:390,margin:"0 auto",color:K.white,background:K.black,minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:"system-ui,sans-serif"}}>
        <div style={{background:K.surface,borderBottom:`1px solid ${K.border}`,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Logo size={26}/>
            <div>
              <div style={{fontWeight:600,fontSize:15,color:K.gold,letterSpacing:3}}>KENDO</div>
              <div style={{fontSize:10,color:K.muted,letterSpacing:1}}>{role==="admin"?"ADMIN":"PIANO "+piano.toUpperCase()}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={B("ghost",{padding:"5px 12px",fontSize:11})}>Esci</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"14px 14px 80px"}}>
          {role==="admin"?(
            <>
              {tab==="home"    && <Dashboard setTab={setTab}/>}
              {tab==="clienti" && <Clienti/>}
              {tab==="agenda"  && <Agenda/>}
              {tab==="followup"&& <FollowUp/>}
              {tab==="chat"    && <ChatAI piano="gold" isAdmin/>}
            </>
          ):(
            <>
              {tab==="home"    && <HomeUser piano={piano} profile={profile} chk={chk} setChk={setChk}/>}
              {tab==="prenota" && <Prenota piano={piano} userId={currentUser?.id} profile={profile} setProfile={setProfile}/>}
              {tab==="bia"     && <BIATab userId={currentUser?.id}/>}
              {tab==="dieta"   && <DietaTab piano={piano}/>}
              {tab==="chat"    && <ChatAI piano={piano} userId={currentUser?.id}/>}
            </>
          )}
        </div>

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
const ADMIN_PIN = "2810";

function LoginScreen({onLogin, onReg, onAdminReg}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [logoTaps,setLogoTaps]=useState(0);
  const [showPin,setShowPin]=useState(false);
  const [pin,setPin]=useState("");
  const [pinError,setPinError]=useState("");
  const [adminEmail,setAdminEmail]=useState("");
  const [adminPass,setAdminPass]=useState("");

  const handleLogin = async () => {
    if(!email||!password){setError("Inserisci email e password");return;}
    setLoading(true);setError("");
    try {
      const {data,error:err} = await supabase.auth.signInWithPassword({email,password});
      if(err){setError("Email o password non corretti");setLoading(false);return;}
      const {data:prof,error:profErr} = await supabase.from("profiles").select("*").eq("id",data.user.id).maybeSingle();
      if(profErr||!prof){setError("Profilo non trovato. Riprova.");setLoading(false);return;}
      onLogin("user", prof, data.user);
    } catch(e){setError("Errore di connessione.");}
    setLoading(false);
  };

  const handleLogoTap = () => {
    const t = logoTaps + 1;
    setLogoTaps(t);
    if(t >= 5){ setShowPin(true); setLogoTaps(0); }
    setTimeout(()=>setLogoTaps(0), 3000);
  };

  const handleAdminLogin = async () => {
    if(pin !== ADMIN_PIN){setPinError("PIN non valido");return;}
    if(!adminEmail||!adminPass){setPinError("Inserisci email e password admin");return;}
    setLoading(true);setPinError("");
    try {
      const {data,error:err} = await supabase.auth.signInWithPassword({email:adminEmail,password:adminPass});
      if(err){setPinError("Credenziali admin non valide");setLoading(false);return;}
      const {data:prof,error:profErr} = await supabase.from("profiles").select("*").eq("id",data.user.id).maybeSingle();
      if(profErr||!prof){setPinError("Profilo non trovato. Errore: "+(profErr?.message||"nessun profilo"));await supabase.auth.signOut();setLoading(false);return;}
      if(!prof.is_admin){setPinError("Questo account non è admin");await supabase.auth.signOut();setLoading(false);return;}
      onLogin("admin", prof, data.user);
    } catch(e){setPinError("Errore di connessione: "+e.message);}
    setLoading(false);
  };

  if(showPin) return (
    <div style={{maxWidth:390,margin:"0 auto",padding:32,minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",background:K.black,fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",marginBottom:30}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Logo size={52}/></div>
        <div style={{fontSize:14,fontWeight:600,color:"#9B8FFF",letterSpacing:2}}>ACCESSO ADMIN</div>
      </div>
      {pinError&&<div style={{background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:K.danger,marginBottom:12}}>{pinError}</div>}
      <div style={C({marginBottom:12})}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:6,letterSpacing:1}}>PIN SICUREZZA</label>
        <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="••••" maxLength={4} style={{marginBottom:14,textAlign:"center",fontSize:20,letterSpacing:8}}/>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:6,letterSpacing:1}}>EMAIL ADMIN</label>
        <input value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="admin@kendo.it" style={{marginBottom:14}}/>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:6,letterSpacing:1}}>PASSWORD ADMIN</label>
        <input type="password" value={adminPass} onChange={e=>setAdminPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()} placeholder="••••••••" style={{marginBottom:20}}/>
        <button onClick={handleAdminLogin} disabled={loading} style={{...B("gold"),width:"100%",padding:13,fontSize:14,opacity:loading?0.7:1,background:"#9B8FFF",color:"#fff"}}>
          {loading?"VERIFICA...":"ACCESSO ADMIN"}
        </button>
      </div>
      <button onClick={()=>{setShowPin(false);setPin("");setPinError("");}} style={B("ghost",{width:"100%",fontSize:12,marginBottom:12})}>← Torna al login</button>
      <div style={{textAlign:"center",fontSize:12,color:K.muted}}>Non hai un account admin? <button onClick={onAdminReg} style={{background:"none",border:"none",color:"#9B8FFF",fontSize:12,cursor:"pointer"}}>Registra il tuo centro</button></div>
    </div>
  );

  return (
    <div style={{maxWidth:390,margin:"0 auto",padding:32,minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",background:K.black,fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12,cursor:"pointer"}} onClick={handleLogoTap}><Logo size={72}/></div>
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
      <div style={{textAlign:"center",fontSize:12,color:K.muted}}>Non hai un account? <button onClick={onReg} style={{background:"none",border:"none",color:K.gold,fontSize:12,cursor:"pointer"}}>Registrati</button></div>
    </div>
  );
}

/* ─── REGISTRAZIONE ─── */
function RegScreen({onBack, onDone}) {
  const [step,setStep]=useState(1);
  const [sel,setSel]=useState("platinum");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(false);
  const [f,setF]=useState({nome:"",cognome:"",email:"",password:"",peso:"",altezza:"",obiettivo:""});
  const u=(k,v)=>setF(p=>({...p,[k]:v}));

  const registra = async () => {
    if(!f.nome||!f.email||!f.password){setError("Compila tutti i campi obbligatori");return;}
    if(f.password.length<6){setError("La password deve avere almeno 6 caratteri");return;}
    setLoading(true);setError("");
    try {
      const {data,error:err} = await supabase.auth.signUp({email:f.email,password:f.password,options:{data:{nome:f.nome}}});
      if(err){setError(err.message);setLoading(false);return;}
      if(data.user){
        await supabase.from("profiles").insert({
          id:data.user.id, nome:f.nome, cognome:f.cognome,
          email:f.email, piano:sel, pacchetto:"EMS",
          sedute_total:10, sedute_usate:0, cancellazioni:0, is_admin:false, tipo_account:"cliente"
        });
        if(f.peso&&f.altezza){
          const bmi=parseFloat((parseFloat(f.peso)/Math.pow(parseFloat(f.altezza)/100,2)).toFixed(1));
          await supabase.from("bia").insert({
            user_id:data.user.id, peso:parseFloat(f.peso), altezza:parseFloat(f.altezza),
            eta:0, grasso_perc:0, massa_muscolare:0, bmi, obiettivo:f.obiettivo, deficit:0
          });
        }
      }
      setSuccess(true);
    } catch(e){setError("Errore durante la registrazione.");}
    setLoading(false);
  };

  if(success) return (
    <div style={{maxWidth:390,margin:"0 auto",padding:32,minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",background:K.black,fontFamily:"system-ui,sans-serif",color:K.white}}>
      <div style={{width:64,height:64,borderRadius:"50%",background:K.successBg,border:`1px solid ${K.success}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:20}}>✉️</div>
      <div style={{fontWeight:600,fontSize:18,marginBottom:8,textAlign:"center"}}>Controlla la tua email!</div>
      <div style={{fontSize:13,color:K.muted,textAlign:"center",marginBottom:8,lineHeight:1.6}}>
        Abbiamo inviato un link di conferma a<br/><span style={{color:K.gold,fontWeight:500}}>{f.email}</span>
      </div>
      <div style={{fontSize:12,color:K.muted,textAlign:"center",marginBottom:28,lineHeight:1.5}}>
        Clicca il link nell'email per attivare il tuo account.<br/>Controlla anche la cartella spam.
      </div>
      <button onClick={()=>onDone(null,null)} style={{...B("gold"),width:"100%",padding:13,fontSize:14}}>Torna al login</button>
    </div>
  );

  if(step===1) return (
    <div style={{maxWidth:390,margin:"0 auto",padding:24,background:K.black,minHeight:"100vh",color:K.white,fontFamily:"system-ui,sans-serif"}}>
      <button onClick={onBack} style={B("ghost",{marginBottom:20,fontSize:12})}>← Indietro</button>
      <div style={{display:"flex",justifyContent:"center",marginBottom:20}}><Logo size={52}/></div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:4}}>Crea account</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:20}}>Unisciti a Kendo</div>
      {error&&<div style={{background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:K.danger,marginBottom:12}}>{error}</div>}
      {[["Nome *","nome","text"],["Cognome *","cognome","text"],["Email *","email","email"],["Password *","password","password"],["Peso (kg)","peso","number"],["Altezza (cm)","altezza","number"]].map(([l,k,t])=>(
        <div key={k} style={{marginBottom:12}}>
          <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>{l.toUpperCase()}</label>
          <input type={t} value={f[k]} onChange={e=>u(k,e.target.value)} placeholder={l.replace(" *","")}/>
        </div>
      ))}
      <div style={{marginBottom:20}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>OBIETTIVO</label>
        <select value={f.obiettivo} onChange={e=>u("obiettivo",e.target.value)}>
          <option value="">Seleziona...</option>
          <option>Dimagrimento</option><option>Massa muscolare</option><option>Tonificazione</option><option>Benessere</option>
        </select>
      </div>
      <button onClick={()=>setStep(2)} style={{...B("gold"),width:"100%",padding:13,fontSize:14}}>Continua →</button>
    </div>
  );

  return (
    <div style={{maxWidth:390,margin:"0 auto",padding:24,background:K.black,minHeight:"100vh",color:K.white,fontFamily:"system-ui,sans-serif"}}>
      <button onClick={()=>setStep(1)} style={B("ghost",{marginBottom:20,fontSize:12})}>← Indietro</button>
      <div style={{fontSize:18,fontWeight:600,marginBottom:4}}>Scegli piano</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:20}}>Cambiabile in qualsiasi momento</div>
      {error&&<div style={{background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:K.danger,marginBottom:12}}>{error}</div>}
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
      <button onClick={registra} disabled={loading} style={{...B("gold"),width:"100%",padding:13,fontSize:14,marginTop:4,opacity:loading?0.7:1}}>
        {loading?"REGISTRAZIONE...":"Inizia con "+PIANI.find(p=>p.id===sel)?.name}
      </button>
    </div>
  );
}

/* ─── REGISTRAZIONE ADMIN ─── */
function AdminRegScreen({onBack, onDone}) {
  const [step,setStep]=useState(1);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(false);
  const [f,setF]=useState({nome:"",cognome:"",email:"",password:"",ragione_sociale:"",partita_iva:"",pec:"",sede_legale:"",telefono:""});
  const u=(k,v)=>setF(p=>({...p,[k]:v}));

  const validaPI = (pi) => /^[0-9]{11}$/.test(pi);
  const validaPEC = (pec) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pec);

  const prosegui = () => {
    if(!f.ragione_sociale||!f.partita_iva||!f.pec||!f.sede_legale||!f.telefono){
      setError("Tutti i campi aziendali sono obbligatori");return;
    }
    if(!validaPI(f.partita_iva)){setError("Partita IVA non valida (11 cifre)");return;}
    if(!validaPEC(f.pec)){setError("Indirizzo PEC non valido");return;}
    setError("");setStep(2);
  };

  const registra = async () => {
    if(!f.nome||!f.cognome||!f.email||!f.password){setError("Compila tutti i campi");return;}
    if(f.password.length<6){setError("La password deve avere almeno 6 caratteri");return;}
    setLoading(true);setError("");
    try {
      const {data,error:err} = await supabase.auth.signUp({email:f.email,password:f.password,options:{data:{nome:f.nome,tipo:"admin"}}});
      if(err){setError(err.message);setLoading(false);return;}
      if(data.user){
        await supabase.from("profiles").insert({
          id:data.user.id, nome:f.nome, cognome:f.cognome,
          email:f.email, telefono:f.telefono, piano:"gold", pacchetto:"EMS",
          sedute_total:0, sedute_usate:0, cancellazioni:0, is_admin:true,
          tipo_account:"admin", ragione_sociale:f.ragione_sociale,
          partita_iva:f.partita_iva, pec:f.pec, sede_legale:f.sede_legale
        });
      }
      setSuccess(true);
    } catch(e){setError("Errore durante la registrazione.");}
    setLoading(false);
  };

  if(success) return (
    <div style={{maxWidth:390,margin:"0 auto",padding:32,minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",background:K.black,fontFamily:"system-ui,sans-serif",color:K.white}}>
      <div style={{width:64,height:64,borderRadius:"50%",background:"#0e0e1e",border:"1px solid #534AB7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:20}}>✉️</div>
      <div style={{fontWeight:600,fontSize:18,marginBottom:8,textAlign:"center",color:"#9B8FFF"}}>Registrazione admin completata!</div>
      <div style={{fontSize:13,color:K.muted,textAlign:"center",marginBottom:8,lineHeight:1.6}}>
        Abbiamo inviato un link di conferma a<br/><span style={{color:"#9B8FFF",fontWeight:500}}>{f.email}</span>
      </div>
      <div style={{fontSize:12,color:K.muted,textAlign:"center",marginBottom:28,lineHeight:1.5}}>
        Conferma la tua email per attivare l'account admin.<br/>Controlla anche la cartella spam.
      </div>
      <button onClick={()=>onDone()} style={{...B("gold"),width:"100%",padding:13,fontSize:14,background:"#9B8FFF",color:"#fff"}}>Torna al login</button>
    </div>
  );

  if(step===1) return (
    <div style={{maxWidth:390,margin:"0 auto",padding:24,background:K.black,minHeight:"100vh",color:K.white,fontFamily:"system-ui,sans-serif"}}>
      <button onClick={onBack} style={B("ghost",{marginBottom:20,fontSize:12})}>← Indietro</button>
      <div style={{display:"flex",justifyContent:"center",marginBottom:16}}><Logo size={42}/></div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:4,color:"#9B8FFF"}}>Registrazione Centro</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:20}}>Inserisci i dati della tua attività</div>
      {error&&<div style={{background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:K.danger,marginBottom:12}}>{error}</div>}
      {[["Ragione sociale *","ragione_sociale","text","Es. Kendo S.R.L.S."],["Partita IVA *","partita_iva","text","11 cifre"],["PEC *","pec","email","email@pec.it"],["Sede legale *","sede_legale","text","Via Roma 1, Milano"],["Telefono *","telefono","tel","333 1234567"]].map(([l,k,t,ph])=>(
        <div key={k} style={{marginBottom:12}}>
          <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>{l.toUpperCase()}</label>
          <input type={t} value={f[k]} onChange={e=>u(k,e.target.value)} placeholder={ph}/>
        </div>
      ))}
      <button onClick={prosegui} style={{...B("gold"),width:"100%",padding:13,fontSize:14,background:"#9B8FFF",color:"#fff",marginTop:8}}>Continua →</button>
    </div>
  );

  return (
    <div style={{maxWidth:390,margin:"0 auto",padding:24,background:K.black,minHeight:"100vh",color:K.white,fontFamily:"system-ui,sans-serif"}}>
      <button onClick={()=>setStep(1)} style={B("ghost",{marginBottom:20,fontSize:12})}>← Indietro</button>
      <div style={{fontSize:18,fontWeight:600,marginBottom:4,color:"#9B8FFF"}}>Dati personali admin</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:20}}>Responsabile dell'account</div>
      {error&&<div style={{background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:K.danger,marginBottom:12}}>{error}</div>}
      <div style={C({background:"#0a0a14",border:"1px solid #1e1e2e",marginBottom:16})}>
        <div style={{fontSize:11,color:"#9B8FFF",marginBottom:6,letterSpacing:1}}>DATI AZIENDA</div>
        <div style={{fontSize:13,color:K.mutedLight}}>{f.ragione_sociale}</div>
        <div style={{fontSize:12,color:K.muted}}>P.IVA {f.partita_iva} · {f.sede_legale}</div>
      </div>
      {[["Nome *","nome","text","Nome"],["Cognome *","cognome","text","Cognome"],["Email *","email","email","email@tuazienda.it"],["Password *","password","password","Minimo 6 caratteri"]].map(([l,k,t,ph])=>(
        <div key={k} style={{marginBottom:12}}>
          <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>{l.toUpperCase()}</label>
          <input type={t} value={f[k]} onChange={e=>u(k,e.target.value)} placeholder={ph}/>
        </div>
      ))}
      <button onClick={registra} disabled={loading} style={{...B("gold"),width:"100%",padding:13,fontSize:14,marginTop:8,background:"#9B8FFF",color:"#fff",opacity:loading?0.7:1}}>
        {loading?"REGISTRAZIONE...":"Registra centro"}
      </button>
    </div>
  );
}

/* ─── HOME UTENTE ─── */
function HomeUser({piano, profile, chk, setChk}) {
  const [pren,setPren]=useState([]);
  const p=PIANI.find(x=>x.id===piano);
  const res=(profile?.sedute_total||0)-(profile?.sedute_usate||0);

  useEffect(()=>{
    if(!profile?.id)return;
    const oggi=new Date().toISOString().split("T")[0];
    supabase.from("prenotazioni").select("*")
      .eq("user_id",profile.id).eq("stato","confermata").gte("data",oggi)
      .order("data").order("ora").limit(1)
      .then(({data})=>setPren(data||[]));
  },[profile]);

  const prox=pren[0];
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <StatBox label="Sedute" value={res} sub="rimaste" color={res<=3?K.danger:K.gold}/>
        <StatBox label="Piano" value={p?.name||"—"} sub="attivo" color={p?.color}/>
        <StatBox label="Pacchetto" value={profile?.pacchetto||"—"} sub="in corso" color="#9B8FFF"/>
        <StatBox label="Cancellazioni" value={profile?.cancellazioni||0} sub="questo mese" color={profile?.cancellazioni>=3?K.danger:K.mutedMid}/>
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
function Prenota({piano, userId, profile, setProfile}) {
  const days=getNext14();
  const [day,setDay]=useState(days[0]);
  const [tipo,setTipo]=useState("EMS");
  const [done,setDone]=useState(null);
  const [pren,setPren]=useState([]);
  const [loading,setLoading]=useState(true);
  const slots=getDaySlots(day);

  const loadPren = useCallback(async()=>{
    if(!userId)return;
    const {data}=await supabase.from("prenotazioni").select("*").eq("stato","confermata");
    setPren(data||[]);setLoading(false);
  },[userId]);

  useEffect(()=>{loadPren();},[loadPren]);

  const busy=pren.filter(p=>p.data===day&&p.tipo===tipo).map(p=>p.ora);
  const mine=pren.filter(p=>p.user_id===userId).sort((a,b)=>a.data.localeCompare(b.data)||a.ora.localeCompare(b.ora));

  const prenota=async(ora)=>{
    const {data,error}=await supabase.from("prenotazioni").insert({user_id:userId,data:day,ora,tipo,stato:"confermata"}).select().single();
    if(!error){setPren(p=>[...p,data]);setDone(data);}
  };

  const cancella=async(id)=>{
    const oggi=new Date().toISOString().split("T")[0];
    const mese=oggi.slice(0,7);
    const cancMese=pren.filter(x=>x.user_id===userId&&x.data.startsWith(mese)&&x.stato==="cancellata").length;
    await supabase.from("prenotazioni").update({stato:"cancellata"}).eq("id",id);
    if(cancMese+1>=3){
      const newUsate=Math.min((profile?.sedute_usate||0)+1, profile?.sedute_total||10);
      const newCanc=(profile?.cancellazioni||0)+1;
      await supabase.from("profiles").update({sedute_usate:newUsate,cancellazioni:newCanc}).eq("id",userId);
      setProfile(p=>({...p,sedute_usate:newUsate,cancellazioni:newCanc}));
      alert("Hai cancellato 3 appuntamenti questo mese. Ti è stata scalata 1 seduta.");
    }
    loadPren();
  };

  if(loading)return <Spinner/>;

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
          {slots.map(ora=>{const occ=busy.includes(ora);const mio=pren.some(p=>p.user_id===userId&&p.data===day&&p.ora===ora&&p.tipo===tipo&&p.stato==="confermata");return(
            <button key={ora} disabled={occ&&!mio} onClick={()=>!occ&&!mio&&prenota(ora)}
              style={{background:mio?K.successBg:occ?"#0e0e0e":K.goldBg,border:`1px solid ${mio?K.success:occ?K.border:K.goldBorder}`,borderRadius:8,padding:"9px 4px",cursor:occ&&!mio?"not-allowed":"pointer",fontSize:12,fontWeight:500,color:mio?K.success:occ?K.muted:K.gold,opacity:occ&&!mio?0.4:1}}>
              {ora}
            </button>
          );})}
        </div>
      )}
      {mine.length>0&&(
        <>
          <div style={{fontWeight:600,fontSize:13,marginBottom:10,letterSpacing:0.5}}>LE MIE PRENOTAZIONI</div>
          {mine.map(p=>(
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
function BIATab({userId}) {
  const [bia,setBia]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!userId)return;
    supabase.from("bia").select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(1).single()
      .then(({data})=>{setBia(data);setLoading(false);});
  },[userId]);

  if(loading)return <Spinner/>;
  if(!bia)return(
    <div style={{textAlign:"center",padding:"3rem 1rem"}}>
      <div style={{fontSize:14,color:K.muted,marginBottom:8}}>Nessun dato BIA disponibile</div>
      <div style={{fontSize:12,color:K.muted}}>Chiedi al tuo trainer di inserire i dati</div>
    </div>
  );

  const BIA_DATA=[{mese:"Inizio",peso:bia.peso+7},{mese:"+1 mese",peso:bia.peso+5},{mese:"+2 mesi",peso:bia.peso+3},{mese:"+3 mesi",peso:bia.peso+1},{mese:"Oggi",peso:bia.peso}];
  const max=Math.max(...BIA_DATA.map(d=>d.peso))+2;
  const min=Math.min(...BIA_DATA.map(d=>d.peso))-2;

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
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[["Peso",bia.peso+" kg"],["Altezza",bia.altezza+" cm"],["Massa grassa",bia.grasso_perc+"%"],["Massa muscolare",bia.massa_muscolare+" kg"],["BMI",bia.bmi],["Obiettivo",bia.obiettivo||"—"]].map(m=>(
          <div key={m[0]} style={C({marginBottom:0})}>
            <div style={{fontSize:11,color:K.muted,marginBottom:4,letterSpacing:1}}>{m[0].toUpperCase()}</div>
            <div style={{fontSize:18,fontWeight:600}}>{m[1]}</div>
          </div>
        ))}
      </div>
      {bia.deficit>0&&<div style={C({marginTop:8,border:`1px solid ${K.goldBorder}`,background:K.goldBg})}>
        <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:4}}>DEFICIT CALORICO TARGET</div>
        <div style={{fontSize:20,fontWeight:600,color:K.gold}}>{bia.deficit} kcal/gg</div>
      </div>}
    </div>
  );
}

/* ─── DIETA ─── */
function DietaTab({piano}) {
  const [chk,setChk]=useState({});
  const locked=piano==="basic";
  if(locked) return (
    <div style={{textAlign:"center",padding:"3rem 1rem"}}>
      <div style={{fontSize:32,marginBottom:16}}>🔒</div>
      <div style={{fontWeight:600,fontSize:16,marginBottom:8}}>Piano dieta non disponibile</div>
      <div style={{fontSize:13,color:K.muted,marginBottom:20}}>Disponibile dal piano Prime in su</div>
      <div style={C({border:`1px solid ${K.goldBorder}`,background:K.goldBg})}>
        {PIANI.filter(p=>p.id!=="basic").map(p=>(
          <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${K.border}`}}>
            <span style={{color:p.color,fontWeight:500}}>{p.name}</span>
            <span style={{color:K.gold,fontSize:13}}>{p.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>Piano alimentare</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>Personalizzato sul tuo obiettivo</div>
      {DIETA.map((d,i)=>(
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
function ChatAI({piano, isAdmin, userId}) {
  const [bia,setBia]=useState(null);
  const pName=PIANI.find(p=>p.id===piano)?.name||piano;

  useEffect(()=>{
    if(!userId||isAdmin)return;
    supabase.from("bia").select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(1).single()
      .then(({data})=>setBia(data));
  },[userId,isAdmin]);

  const bioStr=bia?`Dati BIA utente: peso ${bia.peso}kg, altezza ${bia.altezza}cm, grasso ${bia.grasso_perc}%, muscolare ${bia.massa_muscolare}kg, BMI ${bia.bmi}, obiettivo: ${bia.obiettivo}, deficit: ${bia.deficit} kcal/gg.`:"";
  const sys = isAdmin
    ? `Sei l'assistente gestionale Kendo. Aiuta l'admin con gestione clienti EMS/Vacufit, retention, rinnovi, follow-up, agenda. Italiano, professionale, conciso.`
    : {
        basic:`Sei l'AI Kendo piano Basic. Parla solo di sedute e dati BIA base. Per funzioni avanzate invita all'upgrade. ${bioStr}`,
        prime:`Sei l'AI Kendo piano Prime. Analizza BIA, dai consigli su deficit calorico e nutrizione. ${bioStr}`,
        platinum:`Sei l'AI Kendo piano Platinum. Analizza BIA in dettaglio, suggerisci piani dieta e allenamento. ${bioStr}`,
        gold:`Sei il coach AI personale Kendo piano Gold. Analizza BIA in profondità, crea piani personalizzati, sii diretto e motivante. ${bioStr}`,
      }[piano]||"";

  const qs = isAdmin
    ? ["Clienti a rischio abbandono","Ottimizzare agenda","Template messaggio rinnovo"]
    : piano==="basic"
    ? ["Cosa dicono i miei dati BIA?","Quante sedute ho rimaste?"]
    : ["Analizza la mia BIA","Come migliorare composizione corporea?","Deficit calorico ottimale","Consigli post-EMS"];

  const [msgs,setMsgs]=useState([{role:"assistant",text:`Ciao! Sono il tuo assistente Kendo${isAdmin?" Admin":` — Piano ${pName}`}. Come posso aiutarti?`}]);
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
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:sys,messages:[...hist,{role:"user",content:txt}]})});
      const data=await res.json();
      if(data.error){setMsgs(p=>[...p,{role:"assistant",text:"Errore: "+data.error}]);}
      else{setMsgs(p=>[...p,{role:"assistant",text:data.content?.map(b=>b.text||"").join("")||"Nessuna risposta."}]);}
    }catch{setMsgs(p=>[...p,{role:"assistant",text:"Errore di connessione al server."}]);}
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
function Dashboard({setTab}) {
  const [clienti,setClienti]=useState([]);
  const [followups,setFollowups]=useState([]);
  const [pren,setPren]=useState([]);
  const [loading,setLoading]=useState(true);
  const [panel,setPanel]=useState(null);
  const oggi=new Date().toISOString().split("T")[0];

  useEffect(()=>{
    Promise.all([
      supabase.from("profiles").select("*").eq("is_admin",false),
      supabase.from("followup").select("*"),
      supabase.from("prenotazioni").select("*").eq("data",oggi).eq("stato","confermata"),
    ]).then(([{data:c},{data:f},{data:p}])=>{
      setClienti(c||[]);setFollowups(f||[]);setPren(p||[]);setLoading(false);
    });
  },[oggi]);

  if(loading)return <Spinner/>;

  const attivi=clienti.filter(c=>c.sedute_usate<c.sedute_total);
  const quasi5=clienti.filter(c=>c.sedute_total-c.sedute_usate<=5);
  const quasi3=clienti.filter(c=>c.sedute_total-c.sedute_usate<=3);
  const canc3=clienti.filter(c=>c.cancellazioni>=3);

  const msgBia=(c)=>`https://wa.me/39${c.telefono}?text=${encodeURIComponent(`Ciao ${c.nome}! 👋 Ti ricordiamo che hai ancora sessioni disponibili. Ti invitiamo a fissare un appuntamento BIA per monitorare i tuoi progressi. — Team Kendo`)}`;
  const msgRinnovo=(c)=>`https://wa.me/39${c.telefono}?text=${encodeURIComponent(`Ciao ${c.nome}! 🏆 Ti mancano solo ${c.sedute_total-c.sedute_usate} sedute. Puoi rinnovare il pacchetto con uno sconto riservato a te! — Team Kendo`)}`;

  const getNome=(uid)=>{const c=clienti.find(x=>x.id===uid);return c?`${c.nome} ${c.cognome}`:"Cliente";};

  /* ─── PANNELLI DETTAGLIO ─── */
  if(panel==="attivi") return (
    <div>
      <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>Clienti attivi</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{attivi.length} clienti con sedute disponibili</div>
      {attivi.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Nessun cliente attivo</div>:
        attivi.map(c=>{const res=c.sedute_total-c.sedute_usate;return(
          <div key={c.id} style={C({cursor:"pointer"})} onClick={()=>setTab("clienti")}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:K.gold,flexShrink:0}}>{(c.nome||"?")[0]}{(c.cognome||"?")[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:500,fontSize:14}}>{c.nome} {c.cognome}</div>
                <div style={{fontSize:11,color:K.muted,marginTop:2}}>{c.pacchetto} · Piano {c.piano}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <span style={Tag(K.gold,K.goldBg,K.goldBorder)}>{res} sed.</span>
                <span style={{fontSize:10,color:K.muted}}>{c.sedute_usate}/{c.sedute_total} usate</span>
              </div>
            </div>
          </div>
        );})}
    </div>
  );

  if(panel==="sessioni") return (
    <div>
      <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>Sessioni oggi</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{fmtDate(oggi)} · {pren.length} prenotazioni</div>
      {pren.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Nessuna sessione oggi</div>:
        pren.sort((a,b)=>a.ora.localeCompare(b.ora)).map(p=>(
          <div key={p.id} style={C()}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontWeight:600,fontSize:18,color:K.gold,minWidth:50}}>{p.ora}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:500,fontSize:14}}>{getNome(p.user_id)}</div>
                <div style={{fontSize:11,color:K.muted,marginTop:2}}>{p.tipo} · 30 min</div>
              </div>
              <span style={Tag(p.tipo==="EMS"?"#6BBEFC":"#B88EFF",p.tipo==="EMS"?"#08101e":"#100e1e")}>{p.tipo}</span>
            </div>
          </div>
        ))
      }
      <button onClick={()=>setTab("agenda")} style={{...B("outline"),width:"100%",marginTop:8,padding:12,fontSize:13}}>Apri agenda completa →</button>
    </div>
  );

  if(panel==="sedute5") return (
    <div>
      <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>Meno di 5 sedute</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{quasi5.length} clienti da ricontattare</div>
      {quasi5.map(c=>{const res=c.sedute_total-c.sedute_usate;return(
        <div key={c.id} style={C({border:`1px solid ${res<=3?K.dangerBorder:K.goldBorder}`,background:res<=3?K.dangerBg:K.goldBg})}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:K.gold,flexShrink:0}}>{(c.nome||"?")[0]}{(c.cognome||"?")[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:500,fontSize:14}}>{c.nome} {c.cognome}</div>
              <div style={{fontSize:11,color:K.muted,marginTop:2}}>{c.pacchetto} · {res} sedute rimaste</div>
            </div>
            <span style={Tag(res<=3?K.danger:K.gold,res<=3?K.dangerBg:K.goldBg,res<=3?K.dangerBorder:K.goldBorder)}>{res} sed.</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <div style={{flex:1,height:4,background:"#1a1a1a",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${(c.sedute_usate/c.sedute_total)*100}%`,background:res<=3?K.danger:K.gold,borderRadius:2}}/></div>
            <span style={{fontSize:11,color:K.muted}}>{c.sedute_usate}/{c.sedute_total}</span>
          </div>
          <div style={{display:"flex",gap:6}}>
            {c.telefono&&<a href={msgBia(c)} target="_blank" rel="noreferrer" style={{...B("success",{flex:1,padding:"8px",fontSize:12,textDecoration:"none",textAlign:"center"})}}>📲 Invita BIA</a>}
            {c.telefono&&res<=3&&<a href={msgRinnovo(c)} target="_blank" rel="noreferrer" style={{...B("danger",{flex:1,padding:"8px",fontSize:12,textDecoration:"none",textAlign:"center"})}}>💬 Rinnovo</a>}
          </div>
        </div>
      );})}
    </div>
  );

  if(panel==="followup") return (
    <div>
      <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>Follow-up aperti</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{followups.length} da gestire</div>
      {followups.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Nessun follow-up</div>:
        followups.map(fw=>{const cl=clienti.find(c=>c.id===fw.cliente_id);return(
          <div key={fw.id} style={C()}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <div style={{fontWeight:500,fontSize:14}}>{cl?`${cl.nome} ${cl.cognome}`:"—"}</div>
              <span style={{fontSize:11,color:K.muted}}>{fw.data_contatto}</span>
            </div>
            {[["Motivo",fw.motivo],["Esito",fw.esito],["Prossima azione",fw.prossima_azione]].map(([l,v])=>v?(
              <div key={l} style={{fontSize:12,marginBottom:2}}><span style={{color:K.muted}}>{l}: </span><span style={{color:K.white}}>{v}</span></div>
            ):null)}
            {cl?.telefono&&<a href={`https://wa.me/39${cl.telefono}`} target="_blank" rel="noreferrer" style={{...B("success",{display:"inline-block",marginTop:8,padding:"6px 12px",fontSize:12,textDecoration:"none"})}}>💬 WhatsApp</a>}
          </div>
        );})}
      <button onClick={()=>setTab("followup")} style={{...B("outline"),width:"100%",marginTop:8,padding:12,fontSize:13}}>Gestisci follow-up →</button>
    </div>
  );

  /* ─── VISTA PRINCIPALE DASHBOARD ─── */
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><Logo size={22}/><span style={{fontWeight:600,fontSize:16,color:K.gold,letterSpacing:1}}>DASHBOARD</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        <div onClick={()=>setPanel("attivi")} style={{...C({marginBottom:0,cursor:"pointer",transition:"border .2s"}),":hover":{borderColor:K.gold}}}>
          <div style={{fontSize:10,color:K.muted,marginBottom:6,letterSpacing:1}}>CLIENTI ATTIVI</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
            <div style={{fontSize:20,fontWeight:600,color:K.gold}}>{attivi.length}</div>
            <div style={{fontSize:10,color:K.goldDim}}>dettagli →</div>
          </div>
          <div style={{fontSize:11,color:K.muted,marginTop:2}}>con sedute</div>
        </div>
        <div onClick={()=>setPanel("sessioni")} style={{...C({marginBottom:0,cursor:"pointer"})}}>
          <div style={{fontSize:10,color:K.muted,marginBottom:6,letterSpacing:1}}>SESSIONI OGGI</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
            <div style={{fontSize:20,fontWeight:600,color:"#9B8FFF"}}>{pren.length}</div>
            <div style={{fontSize:10,color:K.goldDim}}>dettagli →</div>
          </div>
          <div style={{fontSize:11,color:K.muted,marginTop:2}}>prenotate</div>
        </div>
        <div onClick={()=>setPanel("sedute5")} style={{...C({marginBottom:0,cursor:"pointer",border:quasi5.length>0?`1px solid ${K.goldBorder}`:`1px solid ${K.border}`})}}>
          <div style={{fontSize:10,color:K.muted,marginBottom:6,letterSpacing:1}}>{"< 5 SEDUTE"}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
            <div style={{fontSize:20,fontWeight:600,color:quasi5.length>0?K.gold:K.muted}}>{quasi5.length}</div>
            <div style={{fontSize:10,color:K.goldDim}}>dettagli →</div>
          </div>
          <div style={{fontSize:11,color:K.muted,marginTop:2}}>da ricontattare</div>
        </div>
        <div onClick={()=>setPanel("followup")} style={{...C({marginBottom:0,cursor:"pointer"})}}>
          <div style={{fontSize:10,color:K.muted,marginBottom:6,letterSpacing:1}}>FOLLOW-UP</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
            <div style={{fontSize:20,fontWeight:600,color:followups.length>0?K.mutedLight:K.muted}}>{followups.length}</div>
            <div style={{fontSize:10,color:K.goldDim}}>dettagli →</div>
          </div>
          <div style={{fontSize:11,color:K.muted,marginTop:2}}>aperti</div>
        </div>
      </div>
      {quasi5.length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:8}}>⚠️ AZIONI RAPIDE</div>
          {quasi5.slice(0,3).map(c=>{const res=c.sedute_total-c.sedute_usate;return(
            <div key={c.id} style={C({border:`1px solid ${res<=3?K.dangerBorder:K.goldBorder}`,background:res<=3?K.dangerBg:K.goldBg})}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:500,fontSize:14}}>{c.nome} {c.cognome}</div>
                  <div style={{fontSize:12,color:K.muted}}>{c.pacchetto} · {res} sed. rimaste</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {c.telefono&&<a href={msgBia(c)} target="_blank" rel="noreferrer" style={{...B("success",{padding:"6px 10px",fontSize:11,textDecoration:"none"})}}>📲 BIA</a>}
                  {c.telefono&&res<=3&&<a href={msgRinnovo(c)} target="_blank" rel="noreferrer" style={{...B("danger",{padding:"6px 10px",fontSize:11,textDecoration:"none"})}}>💬</a>}
                </div>
              </div>
            </div>
          );})}
          {quasi5.length>3&&<button onClick={()=>setPanel("sedute5")} style={{...B("flat"),width:"100%",fontSize:12,marginTop:4}}>Vedi tutti ({quasi5.length}) →</button>}
        </div>
      )}
      {canc3.length>0&&(
        <div>
          <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:8}}>⚡ CANCELLAZIONI ECCESSIVE</div>
          {canc3.map(c=>(
            <div key={c.id} style={C({border:`1px solid ${K.dangerBorder}`,background:K.dangerBg})}>
              <div style={{fontWeight:500,fontSize:14}}>{c.nome} {c.cognome}</div>
              <div style={{fontSize:12,color:K.danger,marginTop:2}}>Cancellazioni: {c.cancellazioni} — seduta decurtata</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── FORM CLIENTE (standalone per evitare re-render) ─── */
function FormCliente({titolo,f,setF,onSalva,onAnnulla}) {
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return (
    <div>
      <button onClick={onAnnulla} style={B("ghost",{marginBottom:20,fontSize:12})}>← Indietro</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:16}}>{titolo}</div>
      {[["Nome","nome","text"],["Cognome","cognome","text"],["Data di nascita","data_nascita","date"],["Luogo di nascita","luogo_nascita","text"],["Indirizzo","indirizzo","text"],["Telefono","telefono","tel"],["Email","email","email"]].map(([l,k,t])=>(
        <div key={k} style={{marginBottom:12}}>
          <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>{l.toUpperCase()}</label>
          <input type={t} value={f[k]||""} onChange={e=>u(k,e.target.value)} placeholder={l}/>
        </div>
      ))}
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>PACCHETTO</label>
        <select value={f.pacchetto||"EMS"} onChange={e=>u("pacchetto",e.target.value)}>{PACK.map(p=><option key={p}>{p}</option>)}</select>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>PIANO</label>
        <select value={f.piano||"basic"} onChange={e=>u("piano",e.target.value)}>{PIANI.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>NOTE</label>
        <textarea value={f.note||""} onChange={e=>u("note",e.target.value)} rows={2} placeholder="Note..."/>
      </div>
      <button onClick={onSalva} style={{...B("gold"),width:"100%",padding:13,fontSize:14}}>{titolo.includes("Modifica")?"Salva modifiche":"Aggiungi cliente"}</button>
    </div>
  );
}

/* ─── CLIENTI ADMIN ─── */
function Clienti() {
  const [clienti,setClienti]=useState([]);
  const [sel,setSel]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [editMode,setEditMode]=useState(false);
  const [loading,setLoading]=useState(true);
  const emptyF={nome:"",cognome:"",data_nascita:"",luogo_nascita:"",indirizzo:"",telefono:"",email:"",note:"",pacchetto:"EMS"};
  const [f,setF]=useState(emptyF);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));

  const load=async()=>{
    const {data}=await supabase.from("profiles").select("*").eq("is_admin",false).order("cognome");
    setClienti(data||[]);setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const aggiungi=async()=>{
    const tot=PACK_SED[f.pacchetto]||10;
    const {data}=await supabase.from("profiles").insert({...f,sedute_total:tot,sedute_usate:0,piano:"basic",cancellazioni:0,is_admin:false}).select().single();
    if(data){setClienti(p=>[...p,data]);setF(emptyF);setShowAdd(false);}
  };
  const salvaModifica=async()=>{
    await supabase.from("profiles").update(f).eq("id",sel);
    setClienti(p=>p.map(c=>c.id===sel?{...c,...f}:c));
    setEditMode(false);
  };
  const elimina=async(id)=>{
    await supabase.from("profiles").delete().eq("id",id);
    setClienti(p=>p.filter(c=>c.id!==id));setSel(null);
  };
  const segnaSeduta=async(id)=>{
    const c=clienti.find(x=>x.id===id);
    if(!c||c.sedute_usate>=c.sedute_total)return;
    const newUsate=c.sedute_usate+1;
    await supabase.from("profiles").update({sedute_usate:newUsate}).eq("id",id);
    setClienti(p=>p.map(x=>x.id===id?{...x,sedute_usate:newUsate}:x));
  };
  const togliSeduta=async(id)=>{
    const c=clienti.find(x=>x.id===id);
    if(!c||c.sedute_usate<=0)return;
    const newUsate=c.sedute_usate-1;
    await supabase.from("profiles").update({sedute_usate:newUsate}).eq("id",id);
    setClienti(p=>p.map(x=>x.id===id?{...x,sedute_usate:newUsate}:x));
  };

  if(loading)return <Spinner/>;
  if(showAdd)return <FormCliente titolo="Nuovo cliente" f={f} setF={setF} onSalva={aggiungi} onAnnulla={()=>setShowAdd(false)}/>;
  if(editMode&&sel){
    return <FormCliente titolo="Modifica anagrafica" f={f} setF={setF} onSalva={salvaModifica} onAnnulla={()=>setEditMode(false)}/>;
  }

  if(sel){
    const c=clienti.find(x=>x.id===sel);
    if(!c)return null;
    const res=c.sedute_total-c.sedute_usate;
    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <button onClick={()=>setSel(null)} style={B("ghost",{fontSize:12})}>← Clienti</button>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setF({nome:c.nome,cognome:c.cognome,data_nascita:c.data_nascita,luogo_nascita:c.luogo_nascita,indirizzo:c.indirizzo,telefono:c.telefono,email:c.email,note:c.note,pacchetto:c.pacchetto,piano:c.piano});setEditMode(true);}} style={B("outline",{padding:"7px 14px",fontSize:12})}>✏️ Modifica</button>
            <button onClick={()=>elimina(c.id)} style={B("danger",{padding:"7px 14px",fontSize:12})}>🗑 Elimina</button>
          </div>
        </div>
        <div style={C()}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:K.gold}}>
              {(c.nome||"?")[0]}{(c.cognome||"?")[0]}
            </div>
            <div>
              <div style={{fontWeight:600,fontSize:16}}>{c.nome} {c.cognome}</div>
              <div style={{fontSize:12,color:K.muted,marginTop:1}}>{c.pacchetto} · Piano {c.piano}</div>
            </div>
          </div>
          <div style={{borderTop:`1px solid ${K.border}`,paddingTop:12,display:"flex",flexDirection:"column",gap:8}}>
            {[["Data nascita",c.data_nascita?new Date(c.data_nascita).toLocaleDateString("it-IT")+" ("+fmtAge(c.data_nascita)+" anni)":"—"],["Luogo nascita",c.luogo_nascita||"—"],["Indirizzo",c.indirizzo||"—"],["Telefono",c.telefono||"—"],["Email",c.email||"—"],["Note",c.note||"—"]].map(([l,v])=>(
              <div key={l} style={{fontSize:13}}><span style={{color:K.muted}}>{l}: </span><span style={{color:K.white}}>{v}</span></div>
            ))}
          </div>
        </div>
        <ClienteBia clienteId={c.id}/>
        <div style={C()}>
          <div style={{fontWeight:500,marginBottom:10,fontSize:13}}>SEDUTE</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{flex:1,height:4,background:"#1a1a1a",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${(c.sedute_usate/c.sedute_total)*100}%`,background:res<=3?K.danger:K.gold,borderRadius:2}}/></div>
            <span style={{fontSize:13,color:res<=3?K.danger:K.gold,fontWeight:600}}>{c.sedute_usate}/{c.sedute_total}</span>
          </div>
          {c.cancellazioni>=3&&<div style={{fontSize:12,color:K.danger,marginBottom:8}}>⚡ {c.cancellazioni} cancellazioni — seduta scalata automaticamente</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>togliSeduta(c.id)} disabled={c.sedute_usate===0} style={{...B("danger",{padding:"10px",fontSize:13})}}>−</button>
            <button onClick={()=>segnaSeduta(c.id)} disabled={res===0} style={{...B("gold",{flex:1,padding:"10px",fontSize:13})}}>+ Segna seduta ({c.sedute_usate}/{c.sedute_total})</button>
            {c.telefono&&<a href={`https://wa.me/39${c.telefono}`} target="_blank" rel="noreferrer" style={{...B("success",{padding:"10px 14px",fontSize:13,textDecoration:"none",display:"flex",alignItems:"center"})}}>WhatsApp</a>}
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
      {clienti.length===0&&<div style={C({textAlign:"center",padding:"2rem",color:K.muted,fontSize:13})}>Nessun cliente ancora</div>}
      {clienti.map(c=>{const res=c.sedute_total-c.sedute_usate;return(
        <div key={c.id} style={C({cursor:"pointer"})} onClick={()=>setSel(c.id)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:K.gold,flexShrink:0}}>{(c.nome||"?")[0]}{(c.cognome||"?")[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:500,fontSize:14}}>{c.nome} {c.cognome}</div>
              <div style={{fontSize:11,color:K.muted,marginTop:2}}>{c.pacchetto} · {c.email}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              <span style={Tag(res<=3?K.danger:K.gold,res<=3?K.dangerBg:K.goldBg,res<=3?K.dangerBorder:K.goldBorder)}>{res} sed.</span>
              {c.cancellazioni>=3&&<span style={Tag(K.danger,K.dangerBg)}>⚡ canc.</span>}
            </div>
          </div>
        </div>
      );})}
    </div>
  );
}

/* ─── BIA CLIENTE (admin) ─── */
function ClienteBia({clienteId}) {
  const [bia,setBia]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [fb,setFb]=useState({peso:"",altezza:"",eta:"",grasso_perc:"",massa_muscolare:"",bmi:"",obiettivo:"",deficit:""});
  const ub=(k,v)=>setFb(p=>({...p,[k]:v}));

  useEffect(()=>{
    supabase.from("bia").select("*").eq("user_id",clienteId).order("created_at",{ascending:false}).limit(1).single()
      .then(({data})=>setBia(data));
  },[clienteId]);

  const salvaBia=async()=>{
    const payload={user_id:clienteId,peso:parseFloat(fb.peso),altezza:parseFloat(fb.altezza),eta:parseInt(fb.eta),grasso_perc:parseFloat(fb.grasso_perc),massa_muscolare:parseFloat(fb.massa_muscolare),bmi:parseFloat(fb.bmi),obiettivo:fb.obiettivo,deficit:parseInt(fb.deficit)||0};
    const {data}=await supabase.from("bia").insert(payload).select().single();
    if(data){setBia(data);setShowForm(false);}
  };

  if(showForm) return (
    <div style={C()}>
      <div style={{fontWeight:500,fontSize:13,marginBottom:12}}>INSERISCI DATI BIA</div>
      {[["Peso (kg)","peso"],["Altezza (cm)","altezza"],["Età","eta"],["Grasso %","grasso_perc"],["Massa muscolare (kg)","massa_muscolare"],["BMI","bmi"],["Deficit kcal/gg","deficit"]].map(([l,k])=>(
        <div key={k} style={{marginBottom:10}}>
          <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>{l}</label>
          <input type="number" value={fb[k]} onChange={e=>ub(k,e.target.value)} placeholder={l}/>
        </div>
      ))}
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>OBIETTIVO</label>
        <select value={fb.obiettivo} onChange={e=>ub("obiettivo",e.target.value)}>
          <option value="">Seleziona...</option>
          <option>Dimagrimento</option><option>Massa muscolare</option><option>Tonificazione</option><option>Benessere</option>
        </select>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={salvaBia} style={{...B("gold"),flex:1,padding:"10px"}}>Salva BIA</button>
        <button onClick={()=>setShowForm(false)} style={{...B("ghost"),padding:"10px"}}>Annulla</button>
      </div>
    </div>
  );

  return (
    <div style={C()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,color:K.muted,letterSpacing:1}}>DATI BIA</div>
        <button onClick={()=>{if(bia)setFb({peso:bia.peso,altezza:bia.altezza,eta:bia.eta,grasso_perc:bia.grasso_perc,massa_muscolare:bia.massa_muscolare,bmi:bia.bmi,obiettivo:bia.obiettivo,deficit:bia.deficit});setShowForm(true);}} style={B("outline",{padding:"5px 10px",fontSize:11})}>
          {bia?"Aggiorna":"+ Inserisci"}
        </button>
      </div>
      {!bia?<div style={{fontSize:12,color:K.muted}}>Nessun dato BIA inserito</div>:(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["Peso",bia.peso+" kg"],["Altezza",bia.altezza+" cm"],["Grasso",bia.grasso_perc+"%"],["Muscolare",bia.massa_muscolare+" kg"],["BMI",bia.bmi],["Obiettivo",bia.obiettivo||"—"],["Deficit",bia.deficit+" kcal"]].map(([l,v])=>(
            <div key={l} style={{background:K.surface,borderRadius:8,padding:"8px"}}>
              <div style={{fontSize:10,color:K.muted,marginBottom:2}}>{l}</div>
              <div style={{fontSize:13,fontWeight:500,color:K.gold}}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── AGENDA ADMIN ─── */
function Agenda() {
  const [pren,setPren]=useState([]);
  const [clienti,setClienti]=useState([]);
  const [loading,setLoading]=useState(true);
  const days=getNext14();
  const [day,setDay]=useState(days[0]);

  useEffect(()=>{
    Promise.all([
      supabase.from("prenotazioni").select("*").eq("stato","confermata"),
      supabase.from("profiles").select("id,nome,cognome").eq("is_admin",false),
    ]).then(([{data:p},{data:c}])=>{setPren(p||[]);setClienti(c||[]);setLoading(false);});
  },[]);

  const dayP=pren.filter(p=>p.data===day).sort((a,b)=>a.ora.localeCompare(b.ora));
  const getNome=(uid)=>{const c=clienti.find(x=>x.id===uid);return c?`${c.nome} ${c.cognome}`:"Cliente";};

  const cancella=async(id)=>{
    await supabase.from("prenotazioni").update({stato:"cancellata"}).eq("id",id);
    setPren(p=>p.filter(x=>x.id!==id));
  };

  if(loading)return <Spinner/>;

  return (
    <div>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>Agenda</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>Tutte le sessioni</div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:14}}>
        {days.map(d=>{const dd=new Date(d);const isSel=d===day;const cnt=pren.filter(p=>p.data===d).length;return(
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
                <div style={{fontSize:13,color:K.mutedLight}}>{getNome(p.user_id)}</div>
              </div>
              <button onClick={()=>cancella(p.id)} style={B("danger",{padding:"6px 10px",fontSize:12})}>✕</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

/* ─── FOLLOWUP ADMIN ─── */
function FollowUp() {
  const [clienti,setClienti]=useState([]);
  const [followups,setFollowups]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [f,setF]=useState({cliente_id:"",data_contatto:"",motivo:"",esito:"",prossima_azione:""});
  const u=(k,v)=>setF(p=>({...p,[k]:v}));

  useEffect(()=>{
    Promise.all([
      supabase.from("profiles").select("id,nome,cognome,telefono").eq("is_admin",false),
      supabase.from("followup").select("*").order("created_at",{ascending:false}),
    ]).then(([{data:c},{data:fw}])=>{setClienti(c||[]);setFollowups(fw||[]);setLoading(false);});
  },[]);

  const aggiungi=async()=>{
    const {data}=await supabase.from("followup").insert(f).select().single();
    if(data){setFollowups(p=>[data,...p]);setF({cliente_id:"",data_contatto:"",motivo:"",esito:"",prossima_azione:""});setShowAdd(false);}
  };
  const elimina=async(id)=>{
    await supabase.from("followup").delete().eq("id",id);
    setFollowups(p=>p.filter(x=>x.id!==id));
  };

  if(loading)return <Spinner/>;

  if(showAdd) return (
    <div>
      <button onClick={()=>setShowAdd(false)} style={B("ghost",{marginBottom:20,fontSize:12})}>← Indietro</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:16}}>Nuovo follow-up</div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>CLIENTE</label>
        <select value={f.cliente_id} onChange={e=>u("cliente_id",e.target.value)}>
          <option value="">Seleziona...</option>
          {clienti.map(c=><option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>)}
        </select>
      </div>
      {[["Data contatto","data_contatto","es. 17/05/2026"],["Motivo","motivo","es. Rinnovo"],["Esito","esito","es. Interessato"],["Prossima azione","prossima_azione","es. Richiamare 20/05"]].map(([l,k,ph])=>(
        <div key={k} style={{marginBottom:12}}>
          <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:5,letterSpacing:1}}>{l.toUpperCase()}</label>
          <input value={f[k]} onChange={e=>u(k,e.target.value)} placeholder={ph}/>
        </div>
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
      {followups.length===0&&<div style={C({textAlign:"center",padding:"2rem",color:K.muted,fontSize:13})}>Nessun follow-up</div>}
      {followups.map(fw=>{const cl=clienti.find(c=>c.id===fw.cliente_id);return(
        <div key={fw.id} style={C()}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div>
              <div style={{fontWeight:500}}>{cl?`${cl.nome} ${cl.cognome}`:"—"}</div>
              <div style={{fontSize:11,color:K.muted,marginTop:2}}>{fw.data_contatto}</div>
            </div>
            <button onClick={()=>elimina(fw.id)} style={{background:"none",border:"none",color:K.muted,cursor:"pointer",fontSize:14}}>✕</button>
          </div>
          {[["Motivo",fw.motivo],["Esito",fw.esito],["Prossima azione",fw.prossima_azione]].map(([l,v])=>(
            <div key={l} style={{fontSize:12,marginBottom:3}}><span style={{color:K.muted}}>{l}: </span><span style={{color:K.white}}>{v}</span></div>
          ))}
          {cl?.telefono&&<a href={`https://wa.me/39${cl.telefono}`} target="_blank" rel="noreferrer" style={{...B("success",{display:"inline-block",marginTop:10,padding:"7px 12px",fontSize:12,textDecoration:"none"})}}>💬 WhatsApp</a>}
        </div>
      );})}
    </div>
  );
}
