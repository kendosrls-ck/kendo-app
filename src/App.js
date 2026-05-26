import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import LeadAdmin from "./LeadAdmin";
import {
  isBiometricSupported,
  hasEnrolledPasskey,
  hasDeclinedEnroll,
  BiometricUnlock,
  BiometricEnrollPrompt
} from "./BiometricGate";

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
      {/* corno sinistro (inclinato verso l'esterno) */}
      <path d="M62 110 L48 18 L70 8 L80 95 Z"/>
      {/* corno centrale (verticale, più alto) */}
      <path d="M92 105 L96 8 L100 0 L104 8 L108 105 Z"/>
      {/* corno destro (inclinato verso l'esterno) */}
      <path d="M138 110 L152 18 L130 8 L120 95 Z"/>
      {/* base elmo a forma di V/Y centrale */}
      <path d="M70 100 L100 150 L130 100 L120 90 L100 120 L80 90 Z"/>
      {/* gamba sinistra a L invertito */}
      <path d="M55 130 L40 145 L40 200 L65 200 L65 165 L75 155 Z"/>
      {/* gamba destra a L invertito (specchio) */}
      <path d="M145 130 L160 145 L160 200 L135 200 L135 165 L125 155 Z"/>
      <text x="100" y="240" textAnchor="middle" fontSize="34" fontFamily="Georgia,serif" letterSpacing="8" fill={K.gold} fontWeight="600">KENDO</text>
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
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isDesktop;
};

export default function App() {
  // Routing pubblico: /prova-gratuita o ?prova=1 mostra la landing senza login
  if (typeof window !== "undefined") {
    const p = window.location.pathname;
    const q = window.location.search;
    if (p.startsWith("/prova-gratuita") || p === "/prova" || q.includes("prova=1")) {
      return <><style>{gs}</style><LandingProvaGratuita/></>;
    }
  }
  const isDesktop = useIsDesktop();
  const [screen,setScreen]=useState("loading");
  const [role,setRole]=useState("user");
  const [tab,setTab]=useState("home");
  const [piano,setPiano]=useState("basic");
  const [currentUser,setCurrentUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [chk,setChk]=useState({diet:false,gym:false});
  // Navigazione cross-tab dalla search globale: punta a un'entità specifica
  const [navTarget,setNavTarget]=useState(null);
  const navigate = (toTab, id) => { setNavTarget({tab: toTab, id, ts: Date.now()}); setTab(toTab); };

  useEffect(()=>{
    (async()=>{
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
          setRole(prof?.is_admin ? "admin" : "user");
          setProfile(prof);
          setCurrentUser(user);
          setPiano(prof?.piano||"basic");
          setTab("home");
          setScreen("app");
          return;
        }
      } catch(e){}
      if (isBiometricSupported() && hasEnrolledPasskey()) setScreen("biolock");
      else setScreen("login");
    })();
  },[]);

  const userNav=[{id:"home",icon:"○",label:"Home"},{id:"prenota",icon:"◷",label:"Prenota"},{id:"bia",icon:"◈",label:"BIA"},{id:"dieta",icon:"◉",label:"Dieta"},{id:"chat",icon:"◎",label:"AI"}];
  const adminNav=[{id:"home",icon:"◈",label:"Dashboard"},{id:"lead",icon:"◆",label:"Lead"},{id:"clienti",icon:"○",label:"Clienti"},{id:"agenda",icon:"◷",label:"Agenda"},{id:"followup",icon:"◉",label:"Follow-up"},{id:"chat",icon:"◎",label:"AI"}];
  const nav = role==="admin"?adminNav:userNav;

  const handleLogin = (r, prof, user) => {
    setRole(r);
    setProfile(prof);
    setCurrentUser(user);
    setPiano(prof?.piano||"basic");
    setTab("home");
    // Proponi l'enroll biometrico solo se: supportato, non ancora attivato, non gia' rifiutato
    if (isBiometricSupported() && !hasEnrolledPasskey() && !hasDeclinedEnroll()) {
      setScreen("bioenroll");
    } else {
      setScreen("app");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Se c'e' una passkey, dopo logout torniamo al gate biometrico (no email/password ogni volta)
    setScreen(hasEnrolledPasskey() ? "biolock" : "login");
    setRole("user");
    setProfile(null);
    setCurrentUser(null);
  };

  // Quando l'utente sblocca col biometrico, ricarichiamo la sessione Supabase
  const handleBiometricUnlock = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // sessione scaduta → chiediamo password
      setScreen("login");
      return;
    }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    handleLogin(prof?.is_admin ? "admin" : "user", prof, user);
    setScreen("app"); // override: salta enroll se gia' siamo passati di li'
  };

  if(screen==="loading") return <><style>{gs}</style><div style={{minHeight:"100vh",background:K.black,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div></>;
  if(screen==="biolock") return <><style>{gs}</style><BiometricUnlock onUnlocked={handleBiometricUnlock} onUsePassword={()=>setScreen("login")}/></>;
  if(screen==="bioenroll") return <><style>{gs}</style><BiometricEnrollPrompt userEmail={currentUser?.email||profile?.email||""} onDone={()=>setScreen("app")}/></>;
  if(screen==="login") return <><style>{gs}</style><LoginScreen onLogin={handleLogin} onReg={()=>setScreen("reg")} onAdminReg={()=>setScreen("adminreg")}/></>;
  if(screen==="reg")   return <><style>{gs}</style><RegScreen onBack={()=>setScreen("login")} onDone={()=>setScreen("login")}/></>;
  if(screen==="adminreg") return <><style>{gs}</style><AdminRegScreen onBack={()=>setScreen("login")} onDone={()=>setScreen("login")}/></>;

  return (
    <>
      <style>{gs}</style>
      <div style={{maxWidth:isDesktop?1280:390,margin:"0 auto",color:K.white,background:K.black,minHeight:"100vh",display:"flex",flexDirection:isDesktop?"row":"column",fontFamily:"system-ui,sans-serif"}}>
        {/* SIDEBAR DESKTOP */}
        {isDesktop && (
          <div style={{width:240,minWidth:240,background:K.surface,borderRight:`1px solid ${K.border}`,padding:"20px 12px",display:"flex",flexDirection:"column",gap:4,height:"100vh",position:"sticky",top:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"4px 12px 18px",borderBottom:`1px solid ${K.border}`,marginBottom:12}}>
              <Logo size={28}/>
              <div>
                <div style={{fontWeight:600,fontSize:15,color:K.gold,letterSpacing:3}}>KENDO</div>
                <div style={{fontSize:9,color:K.muted,letterSpacing:1}}>{role==="admin"?"ADMIN":"PIANO "+(piano||"basic").toUpperCase()}</div>
              </div>
            </div>
            {nav.map(n=>(
              <button key={n.id} onClick={()=>setTab(n.id)} style={{
                background:tab===n.id?K.goldBg:"transparent",
                border:`1px solid ${tab===n.id?K.goldBorder:"transparent"}`,
                color:tab===n.id?K.gold:K.mutedLight,
                fontWeight:tab===n.id?600:400,
                cursor:"pointer", display:"flex", alignItems:"center", gap:12,
                padding:"10px 14px", borderRadius:8, fontSize:13, fontFamily:"inherit",
                textAlign:"left", letterSpacing:0.5
              }}>
                <span style={{fontSize:16,width:18,textAlign:"center"}}>{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
            <div style={{flex:1}}/>
            <button onClick={handleLogout} style={B("ghost",{padding:"8px 14px",fontSize:12,marginTop:8})}>← Esci</button>
          </div>
        )}

        {/* COLONNA PRINCIPALE */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
          {/* HEADER MOBILE (sticky) */}
          {!isDesktop && (
            <div style={{background:K.surface,borderBottom:`1px solid ${K.border}`,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Logo size={26}/>
                <div>
                  <div style={{fontWeight:600,fontSize:15,color:K.gold,letterSpacing:3}}>KENDO</div>
                  <div style={{fontSize:10,color:K.muted,letterSpacing:1}}>{role==="admin"?"ADMIN":"PIANO "+(piano||"basic").toUpperCase()}</div>
                </div>
              </div>
              <button onClick={handleLogout} style={B("ghost",{padding:"5px 12px",fontSize:11})}>Esci</button>
            </div>
          )}

          {role==="admin" && (
            <div style={{padding:isDesktop?"14px 32px 0":"10px 14px 0",background:K.surface}}>
              <GlobalSearch onNavigate={navigate}/>
            </div>
          )}
          <div style={{flex:1,overflowY:"auto",padding:isDesktop?"14px 32px 24px":"14px 14px 80px"}}>
            {role==="admin"?(
              <>
                {tab==="home"    && <Dashboard setTab={setTab}/>}
                {tab==="lead"    && <LeadAdmin navTarget={navTarget}/>}
                {tab==="clienti" && <Clienti navTarget={navTarget}/>}
                {tab==="agenda"  && <Agenda/>}
                {tab==="followup"&& <FollowUp/>}
                {tab==="chat"    && <ChatAI piano="gold" isAdmin/>}
                {tab==="settings"&& <Settings/>}
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

          {/* NAV INFERIORE MOBILE */}
          {!isDesktop && (
            <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:390,background:K.surface,borderTop:`1px solid ${K.border}`,display:"flex",justifyContent:"space-around",padding:"10px 0 12px",zIndex:10}}>
              {nav.map(n=>(
                <button key={n.id} onClick={()=>setTab(n.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"0 8px"}}>
                  <span style={{fontSize:16,color:tab===n.id?K.gold:K.muted}}>{n.icon}</span>
                  <span style={{fontSize:10,color:tab===n.id?K.gold:K.muted,fontWeight:tab===n.id?600:400,letterSpacing:0.5}}>{n.label}</span>
                  {tab===n.id&&<div style={{width:16,height:1.5,background:K.gold,borderRadius:2}}/>}
                </button>
              ))}
            </div>
          )}
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
  const [f,setF]=useState({nome:"",cognome:"",email:"",telefono:"",password:"",peso:"",altezza:"",obiettivo:""});
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
        try {
          const emailMatch = f.email?.trim().toLowerCase();
          const telDigits = (f.telefono||"").replace(/[^0-9]/g,"").replace(/^39/,"");
          let match = null;
          if (emailMatch) {
            const {data:c} = await supabase.from("clienti").select("id")
              .ilike("email", emailMatch).is("user_id", null).limit(1).maybeSingle();
            if (c) match = c;
          }
          if (!match && telDigits) {
            const {data:c} = await supabase.from("clienti").select("id")
              .ilike("telefono", "%"+telDigits).is("user_id", null).limit(1).maybeSingle();
            if (c) match = c;
          }
          if (match) {
            await supabase.from("clienti").update({user_id:data.user.id}).eq("id", match.id);
            await supabase.from("profiles").update({cliente_id:match.id}).eq("id", data.user.id);
          }
        } catch(e){}
        const pesoN=parseFloat(f.peso); const altN=parseFloat(f.altezza);
        if(!isNaN(pesoN)&&!isNaN(altN)&&altN>0){
          const bmi=parseFloat((pesoN/Math.pow(altN/100,2)).toFixed(1));
          await supabase.from("bia").insert({
            user_id:data.user.id, peso:pesoN, altezza:altN,
            eta:0, grasso_perc:0, massa_muscolare:0, bmi, obiettivo:f.obiettivo||null, deficit:0
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
      {[["Nome *","nome","text"],["Cognome *","cognome","text"],["Email *","email","email"],["Telefono","telefono","tel"],["Password *","password","password"],["Peso (kg)","peso","number"],["Altezza (cm)","altezza","number"]].map(([l,k,t])=>(
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
  const [cliente,setCliente]=useState(null);
  const p=PIANI.find(x=>x.id===piano)||PIANI[0];

  useEffect(()=>{
    if(!profile?.id)return;
    const oggi=new Date().toISOString().split("T")[0];
    supabase.from("prenotazioni").select("*")
      .eq("user_id",profile.id).eq("stato","confermata").gte("data",oggi)
      .order("data").order("ora").limit(1)
      .then(({data})=>setPren(data||[]));
    supabase.from("clienti").select("*").eq("user_id",profile.id).maybeSingle()
      .then(({data,error})=>{if(!error&&data)setCliente(data);})
      .catch(()=>{});
  },[profile]);

  if(!profile)return <Spinner/>;

  const seduteTot   = cliente?.sedute_total ?? profile?.sedute_total ?? 0;
  const seduteUsate = cliente?.sedute_usate ?? profile?.sedute_usate ?? 0;
  const res         = Math.max(0, seduteTot - seduteUsate);
  const pacchetto   = cliente?.pacchetto ?? profile?.pacchetto ?? "—";
  const fmtD        = (d)=>d?new Date(d).toLocaleDateString("it-IT"):"—";
  const prox=pren[0];
  return (
    <div>
      {cliente&&<div style={C({background:K.successBg,border:`1px solid ${K.successBorder}`,marginBottom:10})}>
        <div style={{fontSize:11,color:K.muted,marginBottom:4,letterSpacing:1}}>SCHEDA COLLEGATA</div>
        <div style={{fontSize:13,color:K.success,fontWeight:500}}>✓ Ciao {cliente.nome}! La tua scheda Fit & Go è collegata.</div>
        {cliente.scadenza_iscrizione&&<div style={{fontSize:11,color:K.mutedMid,marginTop:4}}>Iscrizione scade il {fmtD(cliente.scadenza_iscrizione)}</div>}
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <StatBox label="Sedute" value={res} sub="rimaste" color={res<=3?K.danger:K.gold}/>
        <StatBox label="Piano" value={p?.name||"—"} sub="attivo" color={p?.color}/>
        <StatBox label="Pacchetto" value={pacchetto} sub="in corso" color="#9B8FFF"/>
        {cliente?.ultima_bia_data
          ? <StatBox label="Ultima BIA" value={fmtD(cliente.ultima_bia_data)} sub="rilevazione" color={K.info}/>
          : <StatBox label="Cancellazioni" value={profile?.cancellazioni||0} sub="questo mese" color={profile?.cancellazioni>=3?K.danger:K.mutedMid}/>
        }
      </div>
      {prox&&<div style={C({border:`1px solid ${K.goldBorder}`,background:K.goldBg,marginBottom:10})}>
        <div style={{fontSize:11,color:K.muted,marginBottom:4,letterSpacing:1}}>PROSSIMA SESSIONE</div>
        <div style={{fontWeight:600,fontSize:16,color:K.gold}}>{prox?.tipo||"—"} — {prox?.ora||"—"}</div>
        <div style={{fontSize:12,color:K.mutedMid,marginTop:3}}>{prox?.data?fmtDate(prox.data):"—"} · 30 min</div>
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

  const busy=(pren||[]).filter(p=>p?.data===day&&p?.tipo===tipo).map(p=>p?.ora).filter(Boolean);
  const mine=(pren||[]).filter(p=>p?.user_id===userId).sort((a,b)=>(a?.data||"").localeCompare(b?.data||"")||(a?.ora||"").localeCompare(b?.ora||""));

  const prenota=async(ora)=>{
    const {data,error}=await supabase.from("prenotazioni").insert({user_id:userId,data:day,ora,tipo,stato:"confermata"}).select().single();
    if(!error){setPren(p=>[...p,data]);setDone(data);}
  };

  const cancella=async(id)=>{
    const oggi=new Date().toISOString().split("T")[0];
    const mese=oggi.slice(0,7);
    const cancMese=(pren||[]).filter(x=>x?.user_id===userId&&(x?.data||"").startsWith(mese)&&x?.stato==="cancellata").length;
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
    if(!userId){setLoading(false);return;}
    supabase.from("bia").select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(1).maybeSingle()
      .then(({data,error})=>{if(!error)setBia(data);setLoading(false);})
      .catch(()=>{setBia(null);setLoading(false);});
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
    supabase.from("bia").select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(1).maybeSingle()
      .then(({data,error})=>{if(!error)setBia(data);})
      .catch(()=>setBia(null));
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

/* ─── MINI CHART SVG (sparkline/bars) ─── */
function MiniBars({ data, color = K.gold, height = 40 }) {
  if (!data || data.length === 0) return <div style={{height, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:K.muted}}>nessun dato</div>;
  const max = Math.max(1, ...data.map(d => d.value || 0));
  const barW = 100 / data.length;
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{display:"block"}}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 4);
        const x = i * barW + barW * 0.15;
        const w = barW * 0.7;
        const y = height - h - 1;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill={color} opacity={d.value === 0 ? 0.2 : 1} rx="0.5"/>
            <title>{d.label}: {d.value}</title>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ slices, size = 90 }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const r = size / 2 - 6;
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => {
        if (s.value === 0) return null;
        const startA = (acc / total) * 2 * Math.PI - Math.PI / 2;
        acc += s.value;
        const endA = (acc / total) * 2 * Math.PI - Math.PI / 2;
        const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
        const x2 = cx + r * Math.cos(endA),   y2 = cy + r * Math.sin(endA);
        const large = endA - startA > Math.PI ? 1 : 0;
        const d = `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        return <path key={i} d={d} fill={s.color}><title>{s.label}: {s.value}</title></path>;
      })}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="#0a0a0a"/>
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="13" fontWeight="600" fill={K.gold}>{total}</text>
    </svg>
  );
}

/* ─── CHARTS DASHBOARD ADMIN ─── */
function DashboardCharts() {
  const [data, setData] = useState({ leadGiornalieri: [], fontiLead: [], conversioniMese: [], statoLead: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const since6mesi = new Date(); since6mesi.setMonth(since6mesi.getMonth() - 6);
      const [{ data: leads30 }, { data: convertiti }, { data: allLeads }] = await Promise.all([
        supabase.from("leads").select("id,created_at,fonte,stato").gte("created_at", since30),
        supabase.from("leads").select("convertito_at").not("convertito_at", "is", null).gte("convertito_at", since6mesi.toISOString()),
        supabase.from("leads").select("stato"),
      ]);

      // Lead giornalieri ultimi 30gg
      const giorni = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().split("T")[0];
        const count = (leads30 || []).filter(l => l.created_at && l.created_at.startsWith(key)).length;
        giorni.push({ label: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }), value: count });
      }

      // Fonti lead ultimi 30gg
      const fontiMap = {};
      (leads30 || []).forEach(l => { const f = l.fonte || "—"; fontiMap[f] = (fontiMap[f] || 0) + 1; });
      const fonteColors = { "Shoma": "#3a7bd5", "Landing": "#D4A843", "Gmail": "#2a9d6f", "Instagram": "#c0392b", "Facebook": "#1877f2", "—": "#666" };
      const fontiLead = Object.entries(fontiMap).map(([label, value]) => ({ label, value, color: fonteColors[label] || "#9B8FFF" })).sort((a, b) => b.value - a.value);

      // Conversioni ultimi 6 mesi
      const mesi = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
        const ym = d.toISOString().slice(0, 7);
        const count = (convertiti || []).filter(c => c.convertito_at && c.convertito_at.startsWith(ym)).length;
        mesi.push({ label: d.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }), value: count });
      }

      // Stato lead totale
      const statoMap = { nuovo: 0, contattato: 0, convertito: 0, scartato: 0 };
      (allLeads || []).forEach(l => { if (l.stato in statoMap) statoMap[l.stato]++; });
      const statoColors = { nuovo: K.gold, contattato: "#3a7bd5", convertito: "#2a9d6f", scartato: "#666" };
      const statoLead = Object.entries(statoMap).map(([k, v]) => ({ label: k, value: v, color: statoColors[k] }));

      setData({ leadGiornalieri: giorni, fontiLead, conversioniMese: mesi, statoLead });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={C({textAlign:"center",padding:"1rem",color:K.muted,fontSize:11})}>Caricamento grafici…</div>;

  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:8}}>📊 ANDAMENTO</div>

      {/* Lead giornalieri */}
      <div style={C()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:12,color:K.mutedLight,fontWeight:500}}>Lead ultimi 30 giorni</div>
          <div style={{fontSize:14,color:K.gold,fontWeight:600}}>{data.leadGiornalieri.reduce((s,x)=>s+x.value,0)} tot</div>
        </div>
        <MiniBars data={data.leadGiornalieri} color={K.gold} height={50}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:K.muted,marginTop:4}}>
          <span>{data.leadGiornalieri[0]?.label || ""}</span>
          <span>oggi</span>
        </div>
      </div>

      {/* Distribuzione fonti */}
      {data.fontiLead.length>0 && (
        <div style={C()}>
          <div style={{fontSize:12,color:K.mutedLight,fontWeight:500,marginBottom:10}}>Fonti lead ultimi 30 giorni</div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <DonutChart slices={data.fontiLead}/>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
              {data.fontiLead.map(f=>(
                <div key={f.label} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                  <div style={{width:10,height:10,borderRadius:2,background:f.color}}/>
                  <span style={{color:K.white}}>{f.label}</span>
                  <span style={{color:K.muted,marginLeft:"auto"}}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conversioni 6 mesi */}
      {data.conversioniMese.some(m=>m.value>0) && (
        <div style={C()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:12,color:K.mutedLight,fontWeight:500}}>Conversioni 6 mesi</div>
            <div style={{fontSize:14,color:K.success,fontWeight:600}}>{data.conversioniMese.reduce((s,x)=>s+x.value,0)} tot</div>
          </div>
          <MiniBars data={data.conversioniMese} color={K.success} height={50}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:K.muted,marginTop:4}}>
            {data.conversioniMese.map((m,i)=>(<span key={i}>{m.label}</span>))}
          </div>
        </div>
      )}

      {/* Stato lead totale */}
      <div style={C()}>
        <div style={{fontSize:12,color:K.mutedLight,fontWeight:500,marginBottom:10}}>Pipeline lead</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {data.statoLead.map(s=>(
            <div key={s.label} style={{background:"#0e0e0e",borderRadius:8,padding:"8px 6px",textAlign:"center",border:`1px solid ${K.border}`}}>
              <div style={{fontSize:10,color:K.muted,marginBottom:2,textTransform:"uppercase"}}>{s.label}</div>
              <div style={{fontSize:16,fontWeight:600,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── SEARCH GLOBALE (admin) ─── */
function GlobalSearch({ onNavigate }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState({ clienti: [], lead: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const debRef = useRef(null);

  useEffect(() => {
    const onClickOut = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, []);

  useEffect(() => {
    if (!q || q.trim().length < 2) { setResults({ clienti: [], lead: [] }); return; }
    clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      setLoading(true);
      const term = q.trim();
      const like = `%${term}%`;
      const [{ data: cli }, { data: led }] = await Promise.all([
        supabase.from("clienti").select("id,nome,cognome,email,telefono,pacchetto,status_crm")
          .or(`nome.ilike.${like},cognome.ilike.${like},email.ilike.${like},telefono.ilike.${like}`)
          .limit(8),
        supabase.from("leads").select("id,nome,cognome,email,cellulare,stato,fonte,letto")
          .or(`nome.ilike.${like},cognome.ilike.${like},email.ilike.${like},cellulare.ilike.${like}`)
          .limit(8),
      ]);
      setResults({ clienti: cli || [], lead: led || [] });
      setLoading(false);
    }, 250);
    return () => clearTimeout(debRef.current);
  }, [q]);

  const tot = results.clienti.length + results.lead.length;

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, maxWidth: 460 }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => q.length >= 2 && setOpen(true)}
        placeholder="🔎 Cerca clienti, lead, telefono, email..."
        style={{
          width: "100%",
          background: "#0e0e0e",
          border: `1px solid ${K.border}`,
          color: K.white,
          borderRadius: 8,
          padding: "9px 14px",
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
      {open && q.trim().length >= 2 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: K.surface, border: `1px solid ${K.border}`, borderRadius: 10,
          maxHeight: 420, overflowY: "auto", zIndex: 100, padding: 6,
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
        }}>
          {loading && <div style={{ padding: 12, fontSize: 12, color: K.muted }}>Cerco…</div>}
          {!loading && tot === 0 && <div style={{ padding: 12, fontSize: 12, color: K.muted }}>Nessun risultato per "{q}"</div>}
          {results.clienti.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: K.muted, padding: "8px 10px 4px", letterSpacing: 1, textTransform: "uppercase" }}>👥 Clienti ({results.clienti.length})</div>
              {results.clienti.map(c => (
                <div key={"c" + c.id} onClick={() => { onNavigate("clienti", c.id); setOpen(false); setQ(""); }}
                  style={{ padding: "8px 10px", cursor: "pointer", borderRadius: 6, fontSize: 12 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#0e0e0e"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ color: K.white, fontWeight: 500 }}>{c.nome} {c.cognome || ""}</div>
                  <div style={{ color: K.muted, fontSize: 11 }}>{c.pacchetto || "—"} · {c.telefono || c.email || "—"}</div>
                </div>
              ))}
            </>
          )}
          {results.lead.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: K.muted, padding: "8px 10px 4px", letterSpacing: 1, textTransform: "uppercase" }}>📩 Lead ({results.lead.length})</div>
              {results.lead.map(l => (
                <div key={"l" + l.id} onClick={() => { onNavigate("lead", l.id); setOpen(false); setQ(""); }}
                  style={{ padding: "8px 10px", cursor: "pointer", borderRadius: 6, fontSize: 12 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#0e0e0e"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ color: K.white, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    {!l.letto && <span style={{ width: 6, height: 6, borderRadius: "50%", background: K.gold }}/>}
                    {l.nome} {l.cognome || ""}
                  </div>
                  <div style={{ color: K.muted, fontSize: 11 }}>{l.stato} · {l.fonte || "—"} · {l.cellulare || l.email || "—"}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── BANNER NOTIFICHE ─── */
function BannerNotifiche() {
  const supportato = typeof Notification !== "undefined";
  const [perm, setPerm] = useState(supportato ? Notification.permission : "unsupported");
  const [hidden, setHidden] = useState(()=>{
    try { return localStorage.getItem("kendo_banner_notif_dismissed")==="1"; } catch(_) { return false; }
  });
  if (!supportato || perm==="granted" || perm==="denied" || hidden) return null;
  const richiedi = async () => {
    try {
      const r = await Notification.requestPermission();
      setPerm(r);
      if (r === "granted") new Notification("✓ Notifiche attive", { body: "Riceverai un avviso per ogni nuovo lead e prenotazione." });
    } catch(_) {}
  };
  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem("kendo_banner_notif_dismissed","1"); } catch(_) {}
  };
  return (
    <div style={C({border:`1px solid ${K.goldBorder}`,background:K.goldBg,display:"flex",alignItems:"center",gap:12})}>
      <div style={{fontSize:24}}>🔔</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,color:K.gold,fontWeight:600,marginBottom:2}}>Abilita le notifiche</div>
        <div style={{fontSize:11,color:K.mutedLight}}>Ricevi un avviso immediato per ogni nuovo lead e prenotazione, anche quando l'app è in background.</div>
      </div>
      <button onClick={richiedi} style={{...B("gold",{padding:"7px 12px",fontSize:11,flexShrink:0})}}>Abilita</button>
      <button onClick={dismiss} style={{background:"none",border:"none",color:K.muted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
    </div>
  );
}

/* ─── DASHBOARD ADMIN ─── */
function Dashboard({setTab}) {
  const [clienti,setClienti]=useState([]);
  const [followups,setFollowups]=useState([]);
  const [pren,setPren]=useState([]);
  const [leadsNuovi,setLeadsNuovi]=useState([]);
  const [loading,setLoading]=useState(true);
  const [panel,setPanel]=useState(null);
  const oggi=new Date().toISOString().split("T")[0];

  const domani = (()=>{const d=new Date();d.setDate(d.getDate()+1);return d.toISOString().split("T")[0];})();
  const [prenDomani,setPrenDomani]=useState([]);

  useEffect(()=>{
    Promise.all([
      supabase.from("clienti").select("*"),
      supabase.from("followup").select("*"),
      supabase.from("prenotazioni").select("*").eq("data",oggi).eq("stato","confermata"),
      supabase.from("leads").select("id,stato").eq("stato","nuovo"),
      supabase.from("prenotazioni").select("*").eq("data",domani).eq("stato","confermata"),
    ]).then(([{data:c},{data:f},{data:p},{data:lN},{data:pD}])=>{
      setClienti(c||[]);setFollowups(f||[]);setPren(p||[]);setLeadsNuovi(lN||[]);setPrenDomani(pD||[]);setLoading(false);
    }).catch(()=>{setLoading(false);});
  },[oggi,domani]);

  // Suono notifica (data URI di un beep dorato breve, ~0.2s)
  const playSound = ()=>{
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o=ctx.createOscillator();const g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.frequency.value=880;o.type="sine";
      g.gain.setValueAtTime(0.15,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.25);
      o.start();o.stop(ctx.currentTime+0.25);
    } catch(_) {}
  };

  // NOTIFICHE PUSH: lead nuovi + prenotazioni nuove + scadenze del giorno
  useEffect(()=>{
    if(typeof window==="undefined"||!("Notification" in window))return;
    let lastLeads = new Set();
    let lastPren = new Set();
    let isMounted = true;
    const notify = (title, body, tag) => {
      if (Notification.permission !== "granted") return;
      try {
        const notif = new Notification(title, { body, tag, icon: "/logo192.png", silent: false });
        notif.onclick = () => { window.focus(); notif.close(); };
        playSound();
      } catch(_) {}
    };
    const check = async () => {
      const [{data: lLeads}, {data: lPren}] = await Promise.all([
        supabase.from("leads").select("id,nome,cognome,cellulare,fonte,letto").eq("stato","nuovo").eq("letto",false).order("created_at",{ascending:false}).limit(20),
        supabase.from("prenotazioni").select("id,user_id,data,ora,tipo").eq("stato","confermata").gte("data", new Date().toISOString().split("T")[0]).order("created_at",{ascending:false}).limit(20),
      ]);
      if (!isMounted) return;
      // Lead nuovi
      if (lLeads) {
        const ids = new Set(lLeads.map(x=>x.id));
        if (lastLeads.size > 0) {
          for (const n of lLeads.filter(x => !lastLeads.has(x.id))) {
            const src = n.fonte ? ` (${n.fonte})` : "";
            notify("📩 Nuovo lead Kendo" + src, `${n.nome||""} ${n.cognome||""} · ${n.cellulare||"senza tel"}`, "lead-"+n.id);
          }
        }
        lastLeads = ids;
      }
      // Prenotazioni nuove
      if (lPren) {
        const ids = new Set(lPren.map(x=>x.id));
        if (lastPren.size > 0) {
          for (const p of lPren.filter(x => !lastPren.has(x.id))) {
            const dt = new Date(p.data).toLocaleDateString("it-IT");
            notify("📅 Nuova prenotazione", `${p.tipo||"Allenamento"} · ${dt} ore ${p.ora||""}`, "pren-"+p.id);
          }
        }
        lastPren = ids;
      }
    };
    check();
    const iv = setInterval(check, 60000);
    return () => { isMounted = false; clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  if(loading)return <Spinner/>;

  const cList=(clienti||[]).filter(c=>c?.status_crm==="CLIENTE ATTIVO"||c?.status_crm==="CLIENTE STAND BY"||!c?.status_crm);
  const attivi=cList.filter(c=>(c?.sedute_usate||0)<(c?.sedute_total||0));
  const haPacchetto=cList.filter(c=>(c?.sedute_total||0)>0);
  const quasi5=haPacchetto.filter(c=>((c?.sedute_total||0)-(c?.sedute_usate||0))<=5);
  const quasi3=haPacchetto.filter(c=>((c?.sedute_total||0)-(c?.sedute_usate||0))<=3);
  const canc3=cList.filter(c=>(c?.cancellazioni||0)>=3);

  // Regole BIA/sedute/scadenze/compleanni
  const oggiD=new Date();
  const giorniDa=(d)=>{if(!d)return Infinity;return Math.floor((oggiD-new Date(d))/(86400000));};
  const giorniA=(d)=>{if(!d)return Infinity;return Math.floor((new Date(d)-oggiD)/(86400000));};
  // Scadenze certificato medico (≤30gg, ed anche già scaduti)
  const certMedicoScad=cList.filter(c=>{const g=giorniA(c?.scadenza_certificato_medico);return g!==Infinity&&g<=30;}).sort((a,b)=>new Date(a.scadenza_certificato_medico)-new Date(b.scadenza_certificato_medico));
  const iscrizioneScad=cList.filter(c=>{const g=giorniA(c?.scadenza_iscrizione);return g!==Infinity&&g<=30;}).sort((a,b)=>new Date(a.scadenza_iscrizione)-new Date(b.scadenza_iscrizione));
  // Compleanni di questo mese
  const meseOggi=oggiD.getMonth();
  const compleanniMese=cList.filter(c=>c?.data_nascita&&new Date(c.data_nascita).getMonth()===meseOggi).sort((a,b)=>new Date(a.data_nascita).getDate()-new Date(b.data_nascita).getDate());
  const giornoOggi=oggiD.getDate();
  const compleanniOggi=compleanniMese.filter(c=>new Date(c.data_nascita).getDate()===giornoOggi);
  // KPI rapidi
  const ggFa=(n)=>{const d=new Date(oggiD);d.setDate(d.getDate()-n);return d.toISOString().split("T")[0];};
  const seduteUltimaSett=0; // placeholder per ora, andrà collegato a prenotazioni passate
  const totSedute=haPacchetto.reduce((s,c)=>s+(c.sedute_usate||0),0);
  const totValore=cList.reduce((s,c)=>s+(parseFloat(c.valore_cliente)||0),0);
  const debitiAttivi=cList.filter(c=>(parseFloat(c.posizione_debitoria)||0)>0).length;
  const biaDaFare=attivi.filter(c=>giorniDa(c.ultima_bia_data)>30);
  const feedback5=attivi.filter(c=>((c?.sedute_total||0)-(c?.sedute_usate||0))===5);
  const rinnovo3=attivi.filter(c=>{const r=(c?.sedute_total||0)-(c?.sedute_usate||0);return r>0&&r<=3;});

  const cleanPhone=(t)=>(t||"").replace(/[^0-9+]/g,"").replace(/^\+?39/,"");
  // Testi dei messaggi WhatsApp (con emoji integre)
  const textBia=(c)=>`Ciao ${c?.nome||""}! 😊 Sono Christian di Fit And Go Padova ⚡ — è passato più di un mese dalla tua ultima BIA. Possiamo fissare una nuova rilevazione per monitorare i tuoi progressi? 📊💪`;
  const textRinnovo=(c)=>{const r=(c?.sedute_total||0)-(c?.sedute_usate||0);return `Ciao ${c?.nome||""}! 🏆 Mancano solo ${r} sedute alla fine del tuo pacchetto. Vuoi rinnovare in anticipo? Hai uno sconto riservato e mantieni la continuità del tuo percorso! 🔥💪 Fammi sapere quando ti va di passare in centro.`;};
  // Copia il messaggio negli appunti e apre WhatsApp con la sola chat.
  // Mettere il testo dentro l'URL corrompe le emoji 4-byte UTF-8 su WhatsApp Desktop,
  // mentre il clipboard le preserva. L'utente fa Ctrl+V (o long-press su mobile).
  const apriWa = async (telefono, text) => {
    const t = cleanPhone(telefono);
    if (!t) return;
    // Backup in clipboard per qualsiasi evenienza
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
    // Mobile -> wa.me (l'app mobile non ha il bug emoji)
    // Desktop -> web.whatsapp.com (browser, gestisce UTF-8 nei params)
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = isMobile
      ? `https://wa.me/39${t}?text=${encodeURIComponent(text)}`
      : `https://web.whatsapp.com/send?phone=39${t}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getNome=(uid)=>{const c=cList.find(x=>x?.id===uid);return c?`${c.nome||""} ${c.cognome||""}`.trim():"Cliente";};

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
            {c.telefono&&<button onClick={()=>apriWa(c.telefono,textBia(c))} style={{...B("success",{flex:1,padding:"8px",fontSize:12,textDecoration:"none",textAlign:"center"})}}>📲 Invita BIA</button>}
            {c.telefono&&res<=3&&<button onClick={()=>apriWa(c.telefono,textRinnovo(c))} style={{...B("danger",{flex:1,padding:"8px",fontSize:12,textDecoration:"none",textAlign:"center"})}}>💬 Rinnovo</button>}
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
            {cl?.telefono&&<a href={`https://api.whatsapp.com/send?phone=39${cl.telefono}`} target="_blank" rel="noreferrer" style={{...B("success",{display:"inline-block",marginTop:8,padding:"6px 12px",fontSize:12,textDecoration:"none"})}}>💬 WhatsApp</a>}
          </div>
        );})}
      <button onClick={()=>setTab("followup")} style={{...B("outline"),width:"100%",marginTop:8,padding:12,fontSize:13}}>Gestisci follow-up →</button>
    </div>
  );

  if(panel==="bia") return (
    <div>
      <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>🩺 BIA da fare</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{biaDaFare.length} clienti senza BIA da più di 30 giorni</div>
      {biaDaFare.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Tutti in regola 👍</div>:
        biaDaFare.map(c=>{const gg=c.ultima_bia_data?giorniDa(c.ultima_bia_data):null;const ult=c.ultima_bia_data?new Date(c.ultima_bia_data).toLocaleDateString("it-IT"):"mai";return(
          <div key={c.id} style={C({border:`1px solid ${K.infoBorder||"#102030"}`,background:K.infoBg||"#08101e"})}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:K.gold,flexShrink:0}}>{(c.nome||"?")[0]}{(c.cognome||"?")[0]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:14}}>{c.nome||""} {c.cognome||""}</div>
                <div style={{fontSize:11,color:K.muted,marginTop:2}}>Ultima BIA: {ult}{gg&&gg!==Infinity?` · ${gg}gg fa`:""}</div>
              </div>
            </div>
            {c.telefono&&<button onClick={()=>apriWa(c.telefono,textBia(c))} style={{...B("success",{display:"block",padding:"8px",fontSize:12,textDecoration:"none",textAlign:"center"})}}>💬 WhatsApp — invito BIA</button>}
          </div>
        );})}
    </div>
  );

  if(panel==="feedback5") return (
    <div>
      <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>💬 Feedback percorso</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{feedback5.length} clienti a 5 sedute residue · <span style={{color:K.gold}}>promemoria interno</span></div>
      <div style={C({background:"#0e0e0e",border:`1px solid ${K.borderMid}`,marginBottom:14})}>
        <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:6}}>NOTA</div>
        <div style={{fontSize:12,color:K.mutedLight,lineHeight:1.5}}>Quando incontri questi clienti in centro, chiedi feedback sul percorso. Nessun messaggio WhatsApp.</div>
      </div>
      {feedback5.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Nessun cliente con esattamente 5 sedute</div>:
        feedback5.map(c=>(
          <div key={c.id} style={C()}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:K.gold,flexShrink:0}}>{(c.nome||"?")[0]}{(c.cognome||"?")[0]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:14}}>{c.nome||""} {c.cognome||""}</div>
                <div style={{fontSize:11,color:K.muted,marginTop:2}}>{c.pacchetto||"—"} · 5 sedute residue</div>
              </div>
              <span style={Tag(K.gold,K.goldBg,K.goldBorder)}>5 sed.</span>
            </div>
          </div>
        ))}
    </div>
  );

  if(panel==="rinnovo") return (
    <div>
      <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>🏆 Proposta rinnovo</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{rinnovo3.length} clienti con 3 o meno sedute residue</div>
      {rinnovo3.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Nessun cliente da contattare</div>:
        rinnovo3.map(c=>{const res=(c.sedute_total||0)-(c.sedute_usate||0);return(
          <div key={c.id} style={C({border:`1px solid ${K.dangerBorder}`,background:K.dangerBg})}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:K.danger,flexShrink:0}}>{(c.nome||"?")[0]}{(c.cognome||"?")[0]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:14}}>{c.nome||""} {c.cognome||""}</div>
                <div style={{fontSize:11,color:K.muted,marginTop:2}}>{c.pacchetto||"—"} · {res} sedute rimaste</div>
              </div>
              <span style={Tag(K.danger,K.dangerBg,K.dangerBorder)}>{res} sed.</span>
            </div>
            {c.telefono&&<button onClick={()=>apriWa(c.telefono,textRinnovo(c))} style={{...B("danger",{display:"block",padding:"8px",fontSize:12,textDecoration:"none",textAlign:"center",fontWeight:600})}}>💬 WhatsApp — proposta rinnovo</button>}
          </div>
        );})}
    </div>
  );

  if(panel==="certMedico") return (
    <div>
      <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>🩺 Certificato medico in scadenza</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{certMedicoScad.length} clienti con certificato scaduto o in scadenza entro 30 giorni</div>
      {certMedicoScad.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Nessun certificato in scadenza 👍</div>:
        certMedicoScad.map(c=>{const g=giorniA(c.scadenza_certificato_medico);const scaduto=g<0;return(
          <div key={c.id} style={C({border:`1px solid ${scaduto?K.dangerBorder:K.goldBorder}`,background:scaduto?K.dangerBg:K.goldBg})}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:K.gold,flexShrink:0}}>{(c.nome||"?")[0]}{(c.cognome||"?")[0]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:14}}>{c.nome||""} {c.cognome||""}</div>
                <div style={{fontSize:11,color:scaduto?K.danger:K.gold,marginTop:2}}>{scaduto?`Scaduto da ${Math.abs(g)}gg`:`Scade tra ${g}gg`} · {new Date(c.scadenza_certificato_medico).toLocaleDateString("it-IT")}</div>
              </div>
            </div>
            {c.telefono&&<button onClick={()=>apriWa(c.telefono,`Ciao ${c.nome||""}! 🩺 Ti ricordo che il tuo certificato medico ${scaduto?"è scaduto":`scade tra ${g} giorni`}. Ti serve per continuare gli allenamenti — quando puoi rinnovarlo? 💪`)} style={{...B("success",{display:"block",width:"100%",padding:"8px",fontSize:12,textAlign:"center",cursor:"pointer"})}}>💬 WhatsApp — rinnovo certificato</button>}
          </div>
        );})}
    </div>
  );

  if(panel==="iscrizione") return (
    <div>
      <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>📅 Iscrizione in scadenza</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{iscrizioneScad.length} clienti con iscrizione scaduta o in scadenza entro 30 giorni</div>
      {iscrizioneScad.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Nessuna iscrizione in scadenza 👍</div>:
        iscrizioneScad.map(c=>{const g=giorniA(c.scadenza_iscrizione);const scaduto=g<0;return(
          <div key={c.id} style={C({border:`1px solid ${scaduto?K.dangerBorder:K.goldBorder}`,background:scaduto?K.dangerBg:K.goldBg})}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:K.gold,flexShrink:0}}>{(c.nome||"?")[0]}{(c.cognome||"?")[0]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:14}}>{c.nome||""} {c.cognome||""}</div>
                <div style={{fontSize:11,color:scaduto?K.danger:K.gold,marginTop:2}}>{scaduto?`Scaduta da ${Math.abs(g)}gg`:`Scade tra ${g}gg`} · {new Date(c.scadenza_iscrizione).toLocaleDateString("it-IT")}</div>
              </div>
            </div>
          </div>
        );})}
    </div>
  );

  if(panel==="compleanno") return (
    <div>
      <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
      <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>🎂 Compleanni del mese</div>
      <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{compleanniMese.length} clienti compiono gli anni questo mese</div>
      {compleanniMese.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Nessun compleanno questo mese</div>:
        compleanniMese.map(c=>{const g=new Date(c.data_nascita).getDate();const eta=oggiD.getFullYear()-new Date(c.data_nascita).getFullYear();return(
          <div key={c.id} style={C()}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:K.gold,flexShrink:0}}>🎂</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:14}}>{c.nome||""} {c.cognome||""}</div>
                <div style={{fontSize:11,color:K.gold,marginTop:2}}>Giorno {g} · {eta} anni</div>
              </div>
            </div>
            {c.telefono&&<button onClick={()=>apriWa(c.telefono,`Buon compleanno ${c.nome||""}! 🎉🎂 Ti aspettiamo presto in centro per festeggiarti con un allenamento speciale! 💪✨`)} style={{...B("gold",{display:"block",width:"100%",padding:"8px",fontSize:12,textAlign:"center",cursor:"pointer"})}}>🎁 Manda gli auguri</button>}
          </div>
        );})}
    </div>
  );

  if(panel==="reminder24h") {
    const getCliente=(uid)=>clienti.find(x=>x.user_id===uid)||{};
    return (
      <div>
        <button onClick={()=>setPanel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Dashboard</button>
        <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>⏰ Reminder per domani</div>
        <div style={{fontSize:12,color:K.muted,marginBottom:14}}>{prenDomani.length} sessioni prenotate per {new Date(domani).toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})}</div>
        {prenDomani.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Nessuna prenotazione domani</div>:
          prenDomani.sort((a,b)=>(a.ora||"").localeCompare(b.ora||"")).map(p=>{
            const c=getCliente(p.user_id);
            const tel=(c.telefono||"").replace(/[^0-9+]/g,"").replace(/^\+?39/,"");
            const msg=`Ciao ${c.nome||""}! ⏰ Ti ricordo la tua seduta di ${p.tipo||"allenamento"} di domani alle ${p.ora||""}. Ci vediamo in centro! 💪⚡`;
            return (
              <div key={p.id} style={C()}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:K.gold,flexShrink:0}}>{p.ora||"?"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,fontSize:14}}>{c.nome||"?"} {c.cognome||""}</div>
                    <div style={{fontSize:11,color:K.muted,marginTop:2}}>{p.tipo||"—"}</div>
                  </div>
                </div>
                {tel&&<button onClick={()=>apriWa(tel,msg)} style={{...B("success",{display:"block",width:"100%",padding:"8px",fontSize:12,textAlign:"center",cursor:"pointer"})}}>💬 Manda reminder</button>}
              </div>
            );
          })
        }
      </div>
    );
  }

  /* ─── VISTA PRINCIPALE DASHBOARD ─── */
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><Logo size={22}/><span style={{fontWeight:600,fontSize:16,color:K.gold,letterSpacing:1}}>DASHBOARD</span></div>

      {/* Banner abilita notifiche (solo se non ancora autorizzate e supportate) */}
      <BannerNotifiche/>

      {/* COMPLEANNI DI OGGI - card prominente */}
      {compleanniOggi.length>0 && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:K.gold,letterSpacing:1,marginBottom:8,fontWeight:600}}>🎂 OGGI COMPIE GLI ANNI</div>
          {compleanniOggi.map(c=>{
            const eta=oggiD.getFullYear()-new Date(c.data_nascita).getFullYear();
            const tel=(c.telefono||"").replace(/[^0-9+]/g,"").replace(/^\+?39/,"");
            const msg=`Tantissimi auguri ${c.nome||""}! 🎉🎂✨ Buon compleanno da tutto il team Fit And Go Padova! Ti aspettiamo presto in centro per festeggiarti con un allenamento speciale 💪⚡`;
            return (
              <div key={c.id} style={C({border:`2px solid ${K.gold}`,background:K.goldBg,display:"flex",alignItems:"center",gap:14})}>
                <div style={{width:44,height:44,borderRadius:"50%",background:K.gold,color:"#080808",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🎂</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15,color:K.gold}}>{c.nome||""} {c.cognome||""}</div>
                  <div style={{fontSize:12,color:K.mutedLight,marginTop:2}}>{eta} anni · Manda gli auguri ora 🎁</div>
                </div>
                {tel && <button onClick={()=>apriWa(tel,msg)} style={{...B("gold",{padding:"10px 14px",fontSize:13,cursor:"pointer",flexShrink:0})}}>🎁 Auguri</button>}
              </div>
            );
          })}
        </div>
      )}

      {(biaDaFare.length>0||feedback5.length>0||rinnovo3.length>0||certMedicoScad.length>0||iscrizioneScad.length>0||compleanniMese.length>0||prenDomani.length>0)&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:K.muted,letterSpacing:1,marginBottom:8}}>⚡ AZIONI DI OGGI</div>
          {rinnovo3.length>0&&(
            <div onClick={()=>setPanel("rinnovo")} style={C({cursor:"pointer",border:`1px solid ${K.dangerBorder}`,background:K.dangerBg,display:"flex",alignItems:"center",gap:14,marginBottom:8})}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.danger,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14}}>🏆</div>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:K.danger}}>{rinnovo3.length} proposte rinnovo (≤3 sedute)</div><div style={{fontSize:11,color:K.mutedLight,marginTop:2}}>Tocca per i messaggi WhatsApp →</div></div>
            </div>
          )}
          {biaDaFare.length>0&&(
            <div onClick={()=>setPanel("bia")} style={C({cursor:"pointer",border:`1px solid ${K.infoBorder||"#102030"}`,background:K.infoBg||"#08101e",display:"flex",alignItems:"center",gap:14,marginBottom:8})}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.info||"#3a7bd5",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14}}>🩺</div>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:K.info||"#3a7bd5"}}>{biaDaFare.length} BIA da fare (oltre 30gg)</div><div style={{fontSize:11,color:K.mutedLight,marginTop:2}}>Invita a nuova rilevazione →</div></div>
            </div>
          )}
          {feedback5.length>0&&(
            <div onClick={()=>setPanel("feedback5")} style={C({cursor:"pointer",border:`1px solid ${K.goldBorder}`,background:"#0e0e0e",display:"flex",alignItems:"center",gap:14,marginBottom:8})}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,color:K.gold,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,border:`1px solid ${K.goldBorder}`}}>💬</div>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:K.gold}}>{feedback5.length} feedback da chiedere (5 sedute)</div><div style={{fontSize:11,color:K.mutedLight,marginTop:2}}>Promemoria interno →</div></div>
            </div>
          )}
          {certMedicoScad.length>0&&(
            <div onClick={()=>setPanel("certMedico")} style={C({cursor:"pointer",border:`1px solid ${K.dangerBorder}`,background:K.dangerBg,display:"flex",alignItems:"center",gap:14,marginBottom:8})}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.danger,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14}}>🩺</div>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:K.danger}}>{certMedicoScad.length} certificati medici in scadenza</div><div style={{fontSize:11,color:K.mutedLight,marginTop:2}}>Entro 30 giorni →</div></div>
            </div>
          )}
          {iscrizioneScad.length>0&&(
            <div onClick={()=>setPanel("iscrizione")} style={C({cursor:"pointer",border:`1px solid ${K.goldBorder}`,background:K.goldBg,display:"flex",alignItems:"center",gap:14,marginBottom:8})}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.gold,color:"#080808",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14}}>📅</div>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:K.gold}}>{iscrizioneScad.length} iscrizioni in scadenza</div><div style={{fontSize:11,color:K.mutedLight,marginTop:2}}>Entro 30 giorni →</div></div>
            </div>
          )}
          {compleanniMese.length>0&&(
            <div onClick={()=>setPanel("compleanno")} style={C({cursor:"pointer",border:`1px solid ${K.goldBorder}`,background:"#0e0e0e",display:"flex",alignItems:"center",gap:14,marginBottom:8})}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,color:K.gold,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,border:`1px solid ${K.goldBorder}`}}>🎂</div>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:K.gold}}>{compleanniMese.length} compleanni questo mese</div><div style={{fontSize:11,color:K.mutedLight,marginTop:2}}>Manda gli auguri →</div></div>
            </div>
          )}
          {prenDomani.length>0&&(
            <div onClick={()=>setPanel("reminder24h")} style={C({cursor:"pointer",border:`1px solid ${K.infoBorder||"#102030"}`,background:K.infoBg||"#08101e",display:"flex",alignItems:"center",gap:14,marginBottom:0})}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.info||"#3a7bd5",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14}}>⏰</div>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:K.info||"#3a7bd5"}}>{prenDomani.length} reminder da inviare (domani)</div><div style={{fontSize:11,color:K.mutedLight,marginTop:2}}>Manda i promemoria WhatsApp →</div></div>
            </div>
          )}
        </div>
      )}
      {leadsNuovi.length>0&&(
        <div onClick={()=>setTab("lead")} style={C({cursor:"pointer",border:`1px solid ${K.gold}`,background:K.goldBg,display:"flex",alignItems:"center",gap:14,marginBottom:14})}>
          <div style={{width:44,height:44,borderRadius:"50%",background:K.gold,color:"#080808",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18}}>◆</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14,color:K.gold}}>{leadsNuovi.length} {leadsNuovi.length===1?"nuovo lead da contattare":"nuovi lead da contattare"}</div>
            <div style={{fontSize:11,color:K.mutedLight,marginTop:2}}>Tocca per aprire la lista lead →</div>
          </div>
        </div>
      )}
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        <div style={C({marginBottom:0})}>
          <div style={{fontSize:9,color:K.muted,marginBottom:4,letterSpacing:1}}>TOT. CLIENTI</div>
          <div style={{fontSize:18,fontWeight:600,color:K.white}}>{cList.length}</div>
        </div>
        <div style={C({marginBottom:0})}>
          <div style={{fontSize:9,color:K.muted,marginBottom:4,letterSpacing:1}}>VALORE CRM</div>
          <div style={{fontSize:18,fontWeight:600,color:K.gold}}>€{totValore.toFixed(0)}</div>
        </div>
        <div style={C({marginBottom:0,border:debitiAttivi>0?`1px solid ${K.dangerBorder}`:`1px solid ${K.border}`,background:debitiAttivi>0?K.dangerBg:K.card})}>
          <div style={{fontSize:9,color:K.muted,marginBottom:4,letterSpacing:1}}>CON DEBITI</div>
          <div style={{fontSize:18,fontWeight:600,color:debitiAttivi>0?K.danger:K.muted}}>{debitiAttivi}</div>
        </div>
      </div>
      <DashboardCharts/>
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
                  {c.telefono&&<button onClick={()=>apriWa(c.telefono,textBia(c))} style={{...B("success",{padding:"6px 10px",fontSize:11,textDecoration:"none"})}}>📲 BIA</button>}
                  {c.telefono&&res<=3&&<button onClick={()=>apriWa(c.telefono,textRinnovo(c))} style={{...B("danger",{padding:"6px 10px",fontSize:11,textDecoration:"none"})}}>💬</button>}
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

/* ─── STATUS PILL (cliente) ─── */
function StatusPill({ stato, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const stati = [
    { k: "CLIENTE ATTIVO", color: K.success, bg: K.successBg, bd: K.successBorder, lab: "Attivo" },
    { k: "CLIENTE STAND BY", color: K.gold, bg: K.goldBg, bd: K.goldBorder, lab: "Stand-by" },
    { k: "FINE PERCORSO", color: K.info, bg: K.infoBg, bd: K.infoBorder, lab: "Concluso" },
    { k: "CANCELLATO", color: K.danger, bg: K.dangerBg, bd: K.dangerBorder, lab: "Cancellato" },
  ];
  const cur = stati.find(s => s.k === (stato || "CLIENTE ATTIVO")) || stati[0];
  return (
    <span ref={wrapRef} style={{ position: "relative" }}>
      <span onClick={() => setOpen(o => !o)} style={{
        background: cur.bg, color: cur.color, border: `1px solid ${cur.bd}`,
        fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 4
      }}>
        {cur.lab} ▾
      </span>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          background: K.surface, border: `1px solid ${K.border}`, borderRadius: 8,
          padding: 4, zIndex: 100, minWidth: 130, boxShadow: "0 8px 24px rgba(0,0,0,0.6)"
        }}>
          {stati.map(s => (
            <div key={s.k} onClick={() => { onChange(s.k); setOpen(false); }} style={{
              padding: "6px 10px", fontSize: 11, cursor: "pointer", borderRadius: 6,
              color: s.k === cur.k ? s.color : K.mutedLight, fontWeight: s.k === cur.k ? 600 : 400
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#0e0e0e"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {s.k === cur.k ? "✓ " : ""}{s.lab}
            </div>
          ))}
        </div>
      )}
    </span>
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
function Clienti({ navTarget }) {
  const [clienti,setClienti]=useState([]);
  const [sel,setSel]=useState(null);
  useEffect(() => {
    if (navTarget && navTarget.tab === "clienti" && navTarget.id) setSel(navTarget.id);
  }, [navTarget]);
  const [showAdd,setShowAdd]=useState(false);
  const [editMode,setEditMode]=useState(false);
  const [loading,setLoading]=useState(true);
  const emptyF={nome:"",cognome:"",data_nascita:"",luogo_nascita:"",indirizzo:"",telefono:"",email:"",note:"",pacchetto:"EMS"};
  const [f,setF]=useState(emptyF);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));

  const [searchTerm,setSearchTerm]=useState("");

  const load=async()=>{
    const {data}=await supabase.from("clienti").select("*").order("cognome",{nullsFirst:false});
    setClienti(data||[]);setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const aggiungi=async()=>{
    const tot=PACK_SED[f.pacchetto]||10;
    const payload={
      nome:f.nome, cognome:f.cognome, email:f.email||null, telefono:f.telefono||null,
      data_nascita:f.data_nascita||null, note:f.note||null, pacchetto:f.pacchetto,
      sedute_total:tot, sedute_usate:0, status_crm:"CLIENTE ATTIVO", negozio:"FIT Padova"
    };
    const {data}=await supabase.from("clienti").insert(payload).select().single();
    if(data){setClienti(p=>[...p,data]);setF(emptyF);setShowAdd(false);}
  };
  const salvaModifica=async()=>{
    const patch={nome:f.nome,cognome:f.cognome,email:f.email||null,telefono:f.telefono||null,
      data_nascita:f.data_nascita||null,note:f.note||null,pacchetto:f.pacchetto};
    await supabase.from("clienti").update(patch).eq("id",sel);
    setClienti(p=>p.map(c=>c.id===sel?{...c,...patch}:c));
    setEditMode(false);
  };
  const elimina=async(id)=>{
    if(!window.confirm("Sicuro di eliminare questo cliente?"))return;
    await supabase.from("clienti").delete().eq("id",id);
    setClienti(p=>p.filter(c=>c.id!==id));setSel(null);
  };
  const segnaSeduta=async(id)=>{
    const c=clienti.find(x=>x.id===id);
    if(!c||(c.sedute_usate||0)>=(c.sedute_total||0))return;
    const newUsate=(c.sedute_usate||0)+1;
    await supabase.from("clienti").update({sedute_usate:newUsate}).eq("id",id);
    setClienti(p=>p.map(x=>x.id===id?{...x,sedute_usate:newUsate}:x));
  };
  const togliSeduta=async(id)=>{
    const c=clienti.find(x=>x.id===id);
    if(!c||(c.sedute_usate||0)<=0)return;
    const newUsate=(c.sedute_usate||0)-1;
    await supabase.from("clienti").update({sedute_usate:newUsate}).eq("id",id);
    setClienti(p=>p.map(x=>x.id===id?{...x,sedute_usate:newUsate}:x));
  };
  const setPacchetto=async(id,pack)=>{
    const tot=PACK_SED[pack]||10;
    await supabase.from("clienti").update({pacchetto:pack,sedute_total:tot}).eq("id",id);
    setClienti(p=>p.map(x=>x.id===id?{...x,pacchetto:pack,sedute_total:tot}:x));
  };

  if(loading)return <Spinner/>;
  if(showAdd)return <FormCliente titolo="Nuovo cliente" f={f} setF={setF} onSalva={aggiungi} onAnnulla={()=>setShowAdd(false)}/>;
  if(editMode&&sel){
    return <FormCliente titolo="Modifica anagrafica" f={f} setF={setF} onSalva={salvaModifica} onAnnulla={()=>setEditMode(false)}/>;
  }

  if(sel){
    const c=(clienti||[]).find(x=>x?.id===sel);
    if(!c)return null;
    const tot=c.sedute_total||0; const usate=c.sedute_usate||0; const res=tot-usate;
    const fmtDate=(s)=>s?new Date(s).toLocaleDateString("it-IT"):"—";
    const waPhone=(c.telefono||"").replace(/[^0-9+]/g,"").replace(/^\+?39/,"");
    const waText=`Ciao ${c.nome||""}! 👋 Sono di Kendo (Fit & Go Padova).`;
    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <button onClick={()=>setSel(null)} style={B("ghost",{fontSize:12})}>← Clienti</button>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setF({nome:c.nome||"",cognome:c.cognome||"",data_nascita:c.data_nascita||"",luogo_nascita:"",indirizzo:"",telefono:c.telefono||"",email:c.email||"",note:c.note||"",pacchetto:c.pacchetto||"EMS"});setEditMode(true);}} style={B("outline",{padding:"7px 14px",fontSize:12})}>✏️ Modifica</button>
            <button onClick={()=>elimina(c.id)} style={B("danger",{padding:"7px 14px",fontSize:12})}>🗑 Elimina</button>
          </div>
        </div>
        <div style={C()}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:K.gold}}>
              {(c.nome||"?")[0]}{(c.cognome||"?")[0]}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:16}}>{c.nome||""} {c.cognome||""}</div>
              <div style={{fontSize:12,color:K.muted,marginTop:3,display:"flex",alignItems:"center",gap:6}}>
                <span>{c.pacchetto||"—"}</span>
                <span>·</span>
                <StatusPill stato={c.status_crm} onChange={async(nuovo)=>{
                  await supabase.from("clienti").update({status_crm:nuovo}).eq("id",c.id);
                  setClienti(p=>p.map(x=>x.id===c.id?{...x,status_crm:nuovo}:x));
                }}/>
              </div>
            </div>
          </div>
          <div style={{borderTop:`1px solid ${K.border}`,paddingTop:12,display:"flex",flexDirection:"column",gap:8}}>
            {[
              ["Telefono",c.telefono||"—"],
              ["Email",c.email||"—"],
              ["Data nascita",c.data_nascita?new Date(c.data_nascita).toLocaleDateString("it-IT")+" ("+fmtAge(c.data_nascita)+" anni)":"—"],
              ["Origine",c.origine||"—"],
              ["Scadenza iscrizione",fmtDate(c.scadenza_iscrizione)],
              ["Certificato medico",fmtDate(c.scadenza_certificato_medico)],
              ["Ultimo appuntamento",fmtDate(c.ultimo_appt_data)],
              ["Ultima BIA",fmtDate(c.ultima_bia_data)],
              ["Valore cliente",`€${(c.valore_cliente||0).toFixed(2)}`],
              ["Posizione debitoria",`€${(c.posizione_debitoria||0).toFixed(2)}`],
              ["Note",c.note||"—"]
            ].map(([l,v])=>(
              <div key={l} style={{fontSize:13}}><span style={{color:K.muted}}>{l}: </span><span style={{color:K.white}}>{v}</span></div>
            ))}
          </div>
        </div>
        <div style={C()}>
          <div style={{fontWeight:500,marginBottom:10,fontSize:13}}>PACCHETTO</div>
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {PACK.map(p=>(
              <button key={p} onClick={()=>setPacchetto(c.id,p)} style={{...B(c.pacchetto===p?"gold":"ghost",{flex:1,padding:"8px 4px",fontSize:11})}}>{p.replace("Combinato ","")}</button>
            ))}
          </div>
          <div style={{fontWeight:500,marginBottom:10,fontSize:13}}>SEDUTE</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{flex:1,height:4,background:"#1a1a1a",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${tot>0?(usate/tot)*100:0}%`,background:res<=3?K.danger:K.gold,borderRadius:2}}/></div>
            <span style={{fontSize:13,color:res<=3?K.danger:K.gold,fontWeight:600}}>{usate}/{tot}</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>togliSeduta(c.id)} disabled={usate===0} style={{...B("danger",{padding:"10px",fontSize:13})}}>−</button>
            <button onClick={()=>segnaSeduta(c.id)} disabled={res===0} style={{...B("gold",{flex:1,padding:"10px",fontSize:13})}}>+ Segna seduta ({usate}/{tot})</button>
            {waPhone&&<button onClick={()=>apriWa(waPhone,waText)} style={{...B("success",{padding:"10px 14px",fontSize:13,display:"flex",alignItems:"center",cursor:"pointer"})}}>💬</button>}
          </div>
        </div>
        <ClienteDocumenti cliente={c} onSaved={(patch)=>setClienti(p=>p.map(x=>x.id===c.id?{...x,...patch}:x))} />
        <ClienteNote cliente={c} />
        <ClienteBia clienteId={c.id} cliente={c} />
      </div>
    );
  }

  return <ClientiList clienti={clienti} onSelect={setSel} onAdd={()=>setShowAdd(true)} searchTerm={searchTerm} setSearchTerm={setSearchTerm}/>;
}

/* ─── LISTA CLIENTI: tabella desktop + card mobile + filtri rapidi ─── */
function ClientiList({ clienti, onSelect, onAdd, searchTerm, setSearchTerm }) {
  const isDesktop = useIsDesktop();
  const [sortKey, setSortKey] = useState("cognome");
  const [sortAsc, setSortAsc] = useState(true);
  const [statoF, setStatoF] = useState("attivi");

  const fmtIT = (s) => s ? new Date(s).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "—";
  const giorniA = (d) => { if (!d) return Infinity; return Math.floor((new Date(d) - new Date()) / 86400000); };

  // Filtro: stato + ricerca
  let lista = (clienti || []).filter(c => {
    if (statoF === "tutti") return true;
    if (statoF === "attivi") return !c.status_crm || c.status_crm === "CLIENTE ATTIVO";
    if (statoF === "standby") return c.status_crm === "CLIENTE STAND BY";
    if (statoF === "conclusi") return c.status_crm === "FINE PERCORSO";
    if (statoF === "cancellati") return c.status_crm === "CANCELLATO";
    if (statoF === "debito") return (parseFloat(c.posizione_debitoria)||0) > 0;
    if (statoF === "pochesedute") { const r=(c.sedute_total||0)-(c.sedute_usate||0); return r > 0 && r <= 3; }
    return true;
  }).filter(c => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return [c?.nome,c?.cognome,c?.email,c?.telefono,c?.pacchetto].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
  });

  // Sort
  lista = [...lista].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === "sedute_res") { va = (a.sedute_total||0)-(a.sedute_usate||0); vb = (b.sedute_total||0)-(b.sedute_usate||0); }
    if (sortKey === "scadenza_certificato_medico" || sortKey === "scadenza_iscrizione" || sortKey === "data_nascita" || sortKey === "ultima_bia_data") {
      va = va ? new Date(va).getTime() : (sortAsc ? Infinity : -Infinity);
      vb = vb ? new Date(vb).getTime() : (sortAsc ? Infinity : -Infinity);
    }
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va == null) va = sortAsc ? "zzz" : "";
    if (vb == null) vb = sortAsc ? "zzz" : "";
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const toggleSort = (k) => { if (sortKey === k) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(true); } };
  const sortIcon = (k) => sortKey === k ? (sortAsc ? "↑" : "↓") : "";

  const filtri = [
    ["attivi", "Attivi"], ["standby", "Stand-by"], ["pochesedute", "≤3 sedute"],
    ["debito", "Con debito"], ["conclusi", "Conclusi"], ["cancellati", "Cancellati"], ["tutti", "Tutti"]
  ];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontWeight:600,fontSize:16}}>Clienti ({lista.length}/{clienti.length})</div>
        <button onClick={onAdd} style={B("gold",{padding:"8px 14px",fontSize:12})}>+ Nuovo cliente</button>
      </div>

      <input
        placeholder="Cerca per nome, telefono, email, pacchetto…"
        value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
        style={{width:"100%",background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",marginBottom:10}}/>

      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
        {filtri.map(([k,lab])=>{
          const active = statoF===k;
          return (
            <button key={k} onClick={()=>setStatoF(k)} style={{
              flexShrink:0,
              background: active ? K.goldBg : "transparent",
              border: `1px solid ${active ? K.gold : K.border}`,
              color: active ? K.gold : K.mutedLight,
              borderRadius: 8, padding:"6px 12px", fontSize:11, cursor:"pointer", fontFamily:"inherit"
            }}>{lab}</button>
          );
        })}
      </div>

      {clienti.length===0 && <div style={C({textAlign:"center",padding:"2rem",color:K.muted,fontSize:13})}>Nessun cliente ancora</div>}
      {lista.length===0 && clienti.length>0 && <div style={C({textAlign:"center",padding:"2rem",color:K.muted,fontSize:13})}>Nessun risultato</div>}

      {/* DESKTOP: tabella sortable */}
      {isDesktop && lista.length > 0 && (
        <div style={C({padding:0,overflow:"hidden"})}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:"#0e0e0e",borderBottom:`1px solid ${K.border}`}}>
                {[
                  ["cognome","Cognome"],["nome","Nome"],["pacchetto","Pacchetto"],
                  ["sedute_res","Sedute"],["ultima_bia_data","Ultima BIA"],
                  ["scadenza_certificato_medico","Cert.medico"],["scadenza_iscrizione","Iscrizione"],
                  ["valore_cliente","Valore €"]
                ].map(([k,lab])=>(
                  <th key={k} onClick={()=>toggleSort(k)} style={{textAlign:"left",padding:"10px 12px",cursor:"pointer",color:K.mutedLight,fontWeight:500,fontSize:11,letterSpacing:0.5,whiteSpace:"nowrap",userSelect:"none"}}>
                    {lab} <span style={{color:K.gold}}>{sortIcon(k)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map(c=>{
                const res = (c.sedute_total||0)-(c.sedute_usate||0);
                const tot = c.sedute_total||0;
                const certG = giorniA(c.scadenza_certificato_medico);
                const iscG = giorniA(c.scadenza_iscrizione);
                return (
                  <tr key={c.id} onClick={()=>onSelect(c.id)} style={{borderBottom:`1px solid ${K.border}`,cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#0e0e0e"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"10px 12px",fontWeight:500,color:K.white}}>{c.cognome||"—"}</td>
                    <td style={{padding:"10px 12px",color:K.mutedLight}}>{c.nome||"—"}</td>
                    <td style={{padding:"10px 12px",color:K.muted,fontSize:11}}>{c.pacchetto||"—"}</td>
                    <td style={{padding:"10px 12px"}}>{tot>0 ? <span style={{color:res<=3?K.danger:res<=5?K.gold:K.success,fontWeight:600}}>{res}<span style={{color:K.muted,fontWeight:400}}>/{tot}</span></span> : <span style={{color:K.muted}}>—</span>}</td>
                    <td style={{padding:"10px 12px",fontSize:11,color:K.mutedLight}}>{fmtIT(c.ultima_bia_data)}</td>
                    <td style={{padding:"10px 12px",fontSize:11,color:certG===Infinity?K.muted:certG<0?K.danger:certG<=30?K.gold:K.mutedLight}}>{fmtIT(c.scadenza_certificato_medico)}</td>
                    <td style={{padding:"10px 12px",fontSize:11,color:iscG===Infinity?K.muted:iscG<0?K.danger:iscG<=30?K.gold:K.mutedLight}}>{fmtIT(c.scadenza_iscrizione)}</td>
                    <td style={{padding:"10px 12px",color:K.gold,fontWeight:600}}>€{(parseFloat(c.valore_cliente)||0).toFixed(0)}{(parseFloat(c.posizione_debitoria)||0)>0 && <span style={{color:K.danger,fontSize:10,marginLeft:6}}>(−€{c.posizione_debitoria})</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MOBILE: card view */}
      {!isDesktop && lista.map(c=>{
        const tot=c.sedute_total||0; const usate=c.sedute_usate||0; const res=tot-usate;
        const haPacchetto=tot>0;
        return(
          <div key={c.id} style={C({cursor:"pointer"})} onClick={()=>onSelect(c.id)}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:K.goldBg,border:`1px solid ${K.goldBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:K.gold,flexShrink:0}}>{(c.nome||"?")[0]}{(c.cognome||"?")[0]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nome||""} {c.cognome||""}</div>
                <div style={{fontSize:11,color:K.muted,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.pacchetto||"—"} · {c.email||c.telefono||"—"}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                {haPacchetto
                  ? <span style={Tag(res<=3?K.danger:K.gold,res<=3?K.dangerBg:K.goldBg,res<=3?K.dangerBorder:K.goldBorder)}>{res} sed.</span>
                  : <span style={Tag(K.muted,"#0e0e0e",K.borderMid)}>no pkg</span>}
                {(c.posizione_debitoria||0)>0&&<span style={Tag(K.danger,K.dangerBg)}>€ debito</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── LANDING PUBBLICA PROVA GRATUITA ─── */
function LandingProvaGratuita() {
  const [f, setF] = useState({ nome: "", cognome: "", email: "", telefono: "", obiettivo: "", note: "", honeypot: "" });
  const [formStartedAt] = useState(Date.now());
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));

  const invia = async () => {
    setError("");
    if (!f.nome || f.nome.length < 2) { setError("Inserisci il tuo nome"); return; }
    if (!f.telefono || f.telefono.replace(/[^0-9]/g, "").length < 8) { setError("Inserisci un numero valido"); return; }
    setSending(true);
    try {
      const r = await fetch("/api/lead-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, formStartedAt }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data?.error || "Errore"); setSending(false); return; }
      setDone(true);
    } catch (e) {
      setError("Connessione assente, riprova");
    }
    setSending(false);
  };

  if (done) return (
    <div style={{minHeight:"100vh",background:K.black,color:K.white,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",fontFamily:"system-ui,sans-serif"}}>
      <div style={{maxWidth:440,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:60,marginBottom:14}}>✅</div>
        <div style={{fontWeight:700,fontSize:22,color:K.gold,marginBottom:10,letterSpacing:1}}>RICHIESTA INVIATA</div>
        <div style={{fontSize:14,color:K.mutedLight,lineHeight:1.6,marginBottom:20}}>
          Grazie {f.nome}! 🎁<br/>Ti contatteremo entro 24h su WhatsApp al numero indicato per fissare insieme la tua prova gratuita.
        </div>
        <div style={{fontSize:12,color:K.muted}}>Fit And Go Padova ⚡ · Allenamento EMS + Vacufit</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:K.black,color:K.white,fontFamily:"system-ui,sans-serif"}}>
      <div style={{maxWidth:480,margin:"0 auto",padding:"30px 18px 60px"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <Logo size={48}/>
          <div style={{fontWeight:700,fontSize:24,color:K.gold,marginTop:10,letterSpacing:4}}>KENDO</div>
          <div style={{fontSize:11,color:K.muted,letterSpacing:2,marginTop:2}}>FIT AND GO PADOVA</div>
        </div>
        <div style={C({padding:"24px 20px"})}>
          <div style={{fontWeight:700,fontSize:22,color:K.gold,marginBottom:8,lineHeight:1.2}}>🎁 Prova gratuita EMS o Vacufit</div>
          <div style={{fontSize:13,color:K.mutedLight,lineHeight:1.5,marginBottom:20}}>
            20 minuti di allenamento personalizzato senza impegno. Compila il form, ti contattiamo entro 24h per fissare insieme la tua prova.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <input placeholder="Nome *" value={f.nome} onChange={e=>u("nome",e.target.value)}
              style={{background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"12px 14px",fontSize:14,fontFamily:"inherit"}}/>
            <input placeholder="Cognome" value={f.cognome} onChange={e=>u("cognome",e.target.value)}
              style={{background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"12px 14px",fontSize:14,fontFamily:"inherit"}}/>
            <input type="tel" placeholder="Cellulare * (es. 333 1234567)" value={f.telefono} onChange={e=>u("telefono",e.target.value)}
              style={{background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"12px 14px",fontSize:14,fontFamily:"inherit"}}/>
            <input type="email" placeholder="Email (opzionale)" value={f.email} onChange={e=>u("email",e.target.value)}
              style={{background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"12px 14px",fontSize:14,fontFamily:"inherit"}}/>
            <select value={f.obiettivo} onChange={e=>u("obiettivo",e.target.value)}
              style={{background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"12px 14px",fontSize:14,fontFamily:"inherit"}}>
              <option value="">Qual è il tuo obiettivo?</option>
              <option>Rimettermi in forma in poco tempo ⏱️</option>
              <option>Tonificare 💪</option>
              <option>Combattere la ritenzione idrica 💧</option>
              <option>Dimagrimento</option>
              <option>Recupero post-infortunio</option>
              <option>Altro</option>
            </select>
            <textarea placeholder="Note (opzionale)" rows={2} value={f.note} onChange={e=>u("note",e.target.value)}
              style={{background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"12px 14px",fontSize:14,fontFamily:"inherit",resize:"vertical"}}/>
            {/* honeypot anti-bot */}
            <input type="text" tabIndex={-1} autoComplete="off" value={f.honeypot} onChange={e=>u("honeypot",e.target.value)}
              style={{position:"absolute",left:"-9999px",opacity:0,pointerEvents:"none"}} aria-hidden="true"/>
            {error && <div style={{color:K.danger,fontSize:13,background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,borderRadius:8,padding:"10px 12px"}}>{error}</div>}
            <button onClick={invia} disabled={sending} style={{...B("gold"),padding:"14px",fontSize:14,marginTop:4}}>
              {sending ? "Invio in corso..." : "🎯 Richiedi la prova gratuita"}
            </button>
            <div style={{fontSize:10,color:K.muted,textAlign:"center",marginTop:6,lineHeight:1.5}}>
              Compilando il form acconsenti al trattamento dei dati per essere ricontattato.<br/>I tuoi dati non saranno condivisi con terzi.
            </div>
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:24,fontSize:11,color:K.muted}}>
          ⚡ Allenamento EMS · 🌀 Vacufit · 📊 BIA professionale
        </div>
      </div>
    </div>
  );
}

/* ─── IMPOSTAZIONI ADMIN ─── */
function Settings() {
  const [tab, setTab] = useState("templates");
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <span style={{fontSize:22}}>⚙</span>
        <span style={{fontWeight:600,fontSize:16,color:K.gold,letterSpacing:1}}>IMPOSTAZIONI</span>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
        {[
          ["templates","Messaggi WhatsApp"],
          ["notifiche","Notifiche"],
          ["export","Esporta dati"],
          ["account","Account"],
        ].map(([k,lab])=>{
          const active = tab===k;
          return (
            <button key={k} onClick={()=>setTab(k)} style={{
              flexShrink:0,
              background: active ? K.goldBg : "transparent",
              border: `1px solid ${active ? K.gold : K.border}`,
              color: active ? K.gold : K.mutedLight,
              borderRadius: 8, padding:"7px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit"
            }}>{lab}</button>
          );
        })}
      </div>
      {tab==="templates" && <MessageTemplates/>}
      {tab==="notifiche" && <NotificheSettings/>}
      {tab==="export" && <ExportData/>}
      {tab==="account" && (
        <div style={C({padding:"20px",textAlign:"center"})}>
          <div style={{fontSize:13,color:K.mutedLight,marginBottom:8}}>Gestione account</div>
          <div style={{fontSize:11,color:K.muted}}>Sezione in arrivo — qui potrai modificare ragione sociale, P.IVA, dati di fatturazione.</div>
        </div>
      )}
    </div>
  );
}

function NotificheSettings() {
  const [perm, setPerm] = useState(typeof Notification!=="undefined" ? Notification.permission : "default");
  const supportato = typeof Notification !== "undefined";

  const richiediPermesso = async () => {
    if (!supportato) { alert("Il tuo browser non supporta le notifiche"); return; }
    try {
      const result = await Notification.requestPermission();
      setPerm(result);
      if (result === "granted") {
        new Notification("✓ Notifiche attive", { body: "Riceverai un avviso ogni volta che arriva un nuovo lead." });
      }
    } catch(e) { alert("Errore: " + e.message); }
  };

  return (
    <div>
      <div style={C()}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:8,color:K.gold}}>🔔 Notifiche nuovi lead</div>
        <div style={{fontSize:12,color:K.mutedLight,lineHeight:1.6,marginBottom:14}}>
          Quando questa schermata è aperta in background, ricevi una notifica di sistema ogni volta che arriva un nuovo lead da Gmail o dalla landing.
          {!supportato && <span style={{color:K.danger}}> Il tuo browser non supporta le notifiche.</span>}
        </div>
        <div style={{padding:"10px 12px",background:"#0e0e0e",border:`1px solid ${K.border}`,borderRadius:8,marginBottom:14}}>
          <div style={{fontSize:11,color:K.muted,marginBottom:4,letterSpacing:1}}>STATO ATTUALE</div>
          <div style={{fontSize:13,color:perm==="granted"?K.success:(perm==="denied"?K.danger:K.mutedLight),fontWeight:600}}>
            {perm==="granted"?"✓ Notifiche attive":perm==="denied"?"✗ Notifiche bloccate (cambia nelle impostazioni del browser)":"○ Non ancora autorizzate"}
          </div>
        </div>
        {perm!=="granted" && perm!=="denied" && supportato && (
          <button onClick={richiediPermesso} style={{...B("gold"),width:"100%",padding:"12px",fontSize:13}}>🔔 Abilita notifiche</button>
        )}
        {perm==="granted" && (
          <button onClick={()=>new Notification("🧪 Test", {body:"Le notifiche funzionano correttamente!"})} style={{...B("ghost"),width:"100%",padding:"10px",fontSize:12}}>Manda notifica di test</button>
        )}
      </div>

      <div style={C()}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:8,color:K.gold}}>🌐 Landing pubblica</div>
        <div style={{fontSize:12,color:K.mutedLight,lineHeight:1.6,marginBottom:10}}>
          Condividi questo link sui social, Instagram bio, biglietti da visita: i nuovi lead arriveranno direttamente nel pannello "Lead".
        </div>
        <div style={{padding:"10px 12px",background:K.goldBg,border:`1px solid ${K.goldBorder}`,borderRadius:8,fontSize:13,color:K.gold,wordBreak:"break-all",fontWeight:600,marginBottom:8}}>
          {typeof window!=="undefined"?window.location.origin:""}/prova-gratuita
        </div>
        <button onClick={()=>{
          const url=window.location.origin+"/prova-gratuita";
          navigator.clipboard.writeText(url);
          alert("Link copiato!");
        }} style={{...B("ghost"),width:"100%",padding:"10px",fontSize:12}}>📋 Copia link</button>
      </div>
    </div>
  );
}

function ExportData() {
  const [exporting, setExporting] = useState(null);

  const csvEscape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const downloadCSV = (rows, filename) => {
    if (!rows || rows.length === 0) { alert("Nessun dato da esportare"); return; }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h => csvEscape(r[h])).join(","))
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportLead = async () => {
    setExporting("lead");
    const { data } = await supabase.from("leads").select("*").order("created_at",{ascending:false});
    downloadCSV(data || [], `kendo-lead-${new Date().toISOString().split("T")[0]}.csv`);
    setExporting(null);
  };

  const exportClienti = async () => {
    setExporting("clienti");
    const { data } = await supabase.from("clienti").select("*").order("cognome");
    downloadCSV(data || [], `kendo-clienti-${new Date().toISOString().split("T")[0]}.csv`);
    setExporting(null);
  };

  const exportBia = async () => {
    setExporting("bia");
    const { data } = await supabase.from("bia").select("*, clienti(nome,cognome)").order("data_rilevazione",{ascending:false});
    const flat = (data || []).map(b => ({
      ...b,
      cliente_nome: b.clienti?.nome || "",
      cliente_cognome: b.clienti?.cognome || "",
      clienti: undefined,
    }));
    downloadCSV(flat, `kendo-bia-${new Date().toISOString().split("T")[0]}.csv`);
    setExporting(null);
  };

  return (
    <div>
      <div style={{fontSize:12,color:K.mutedLight,marginBottom:14,lineHeight:1.6}}>
        Scarica i tuoi dati come file CSV. Puoi aprirli in Excel, Numbers o importarli in altri gestionali per backup o analisi.
      </div>

      <div style={C()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:600,fontSize:14,marginBottom:2,color:K.gold}}>📩 Lead</div>
            <div style={{fontSize:11,color:K.muted}}>Tutti i lead ricevuti da Gmail, Landing, Shoma</div>
          </div>
          <button onClick={exportLead} disabled={exporting==="lead"} style={B("gold",{padding:"8px 14px",fontSize:12})}>{exporting==="lead"?"...":"Esporta"}</button>
        </div>
      </div>

      <div style={C()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:600,fontSize:14,marginBottom:2,color:K.gold}}>👥 Clienti</div>
            <div style={{fontSize:11,color:K.muted}}>Anagrafica completa, pacchetti, sedute, scadenze, valore CRM</div>
          </div>
          <button onClick={exportClienti} disabled={exporting==="clienti"} style={B("gold",{padding:"8px 14px",fontSize:12})}>{exporting==="clienti"?"...":"Esporta"}</button>
        </div>
      </div>

      <div style={C()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:600,fontSize:14,marginBottom:2,color:K.gold}}>📊 BIA</div>
            <div style={{fontSize:11,color:K.muted}}>Storico bioimpedenziometrie con riferimento cliente</div>
          </div>
          <button onClick={exportBia} disabled={exporting==="bia"} style={B("gold",{padding:"8px 14px",fontSize:12})}>{exporting==="bia"?"...":"Esporta"}</button>
        </div>
      </div>

      <div style={{fontSize:11,color:K.muted,marginTop:12,padding:"10px 12px",background:"#0e0e0e",border:`1px solid ${K.border}`,borderRadius:8,lineHeight:1.5}}>
        💡 <b>Consiglio CTO</b>: esporta i CSV una volta al mese come backup. In caso di problemi al database, hai sempre una copia recente dei tuoi dati.
      </div>
    </div>
  );
}

function MessageTemplates() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [corpo, setCorpo] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const load = () => {
    setLoading(true);
    supabase.from("message_templates").select("*").order("titolo")
      .then(({data})=>{setList(data||[]);setLoading(false);});
  };
  useEffect(()=>{load();},[]);

  useEffect(()=>{
    if (sel) {
      const t = list.find(x=>x.id===sel);
      if (t) setCorpo(t.corpo || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const salva = async () => {
    if (!sel) return;
    setSaving(true);
    const { error } = await supabase.from("message_templates")
      .update({ corpo, updated_at: new Date().toISOString() })
      .eq("id", sel);
    setSaving(false);
    if (error) {
      alert("Errore salvataggio: " + error.message);
      return;
    }
    setList(p => p.map(t => t.id===sel ? {...t, corpo, updated_at: new Date().toISOString()} : t));
    setSavedAt(new Date());
    setTimeout(()=>setSavedAt(null), 3000);
  };

  if (loading) return <Spinner/>;

  if (sel) {
    const t = list.find(x=>x.id===sel);
    if (!t) { setSel(null); return null; }
    return (
      <div>
        <button onClick={()=>setSel(null)} style={B("ghost",{marginBottom:14,fontSize:12})}>← Tutti i messaggi</button>
        <div style={C()}>
          <div style={{fontWeight:600,fontSize:15,marginBottom:4,color:K.gold}}>{t.titolo}</div>
          <div style={{fontSize:11,color:K.muted,marginBottom:14}}>{t.descrizione||"—"}</div>
          {t.variabili && t.variabili.length>0 && (
            <div style={{marginBottom:14,padding:"10px 12px",background:"#0e0e0e",border:`1px solid ${K.border}`,borderRadius:8}}>
              <div style={{fontSize:10,color:K.muted,marginBottom:6,letterSpacing:1}}>VARIABILI DISPONIBILI</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {t.variabili.map(v=>(
                  <code key={v} style={{fontSize:11,padding:"3px 8px",background:K.goldBg,border:`1px solid ${K.goldBorder}`,borderRadius:6,color:K.gold}}>{"{"+v+"}"}</code>
                ))}
              </div>
              <div style={{fontSize:10,color:K.muted,marginTop:8}}>Esempio: <code>{"{nome}"}</code> sarà sostituito automaticamente con il nome del cliente al momento dell'invio.</div>
            </div>
          )}
          <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:6,letterSpacing:1}}>TESTO DEL MESSAGGIO</label>
          <textarea value={corpo} onChange={e=>setCorpo(e.target.value)} rows={10}
            style={{width:"100%",background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"12px 14px",fontSize:13,fontFamily:"inherit",resize:"vertical",lineHeight:1.5}}/>
          <div style={{display:"flex",gap:8,marginTop:12,alignItems:"center"}}>
            <button onClick={salva} disabled={saving} style={{...B("gold",{flex:1,padding:"12px",fontSize:13})}}>{saving?"Salvataggio...":"💾 Salva modifiche"}</button>
            {savedAt && <span style={{fontSize:11,color:K.success}}>✓ Salvato</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{fontSize:12,color:K.mutedLight,marginBottom:14}}>
        Modifica i messaggi WhatsApp che l'app invia automaticamente. Le variabili tra graffe <code style={{color:K.gold}}>{"{nome}"}</code> vengono compilate al volo con i dati del cliente.
      </div>
      {list.length===0?<div style={C({textAlign:"center",padding:"2rem",color:K.muted})}>Nessun template configurato</div>:
        list.map(t=>(
          <div key={t.id} onClick={()=>setSel(t.id)} style={C({cursor:"pointer"})}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:6}}>
              <div style={{fontWeight:600,fontSize:14,color:K.gold}}>{t.titolo}</div>
              <span style={{fontSize:10,color:K.muted}}>{t.codice}</span>
            </div>
            {t.descrizione && <div style={{fontSize:11,color:K.muted,marginBottom:8}}>{t.descrizione}</div>}
            <div style={{fontSize:12,color:K.mutedLight,fontStyle:"italic",lineHeight:1.4,maxHeight:60,overflow:"hidden",textOverflow:"ellipsis"}}>{(t.corpo||"").slice(0,150)}{(t.corpo||"").length>150?"…":""}</div>
          </div>
        ))
      }
    </div>
  );
}

/* ─── NOTE RAPIDE CLIENTE (followup timeline) ─── */
function ClienteNote({ cliente }) {
  const [storia, setStoria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [esito, setEsito] = useState("");
  const [prossimaAzione, setProssimaAzione] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cliente?.id) { setLoading(false); return; }
    setLoading(true);
    // followup è legato a profiles.id, ma la nostra logica usa l'id del CRM clienti.
    // Tentativo: filtriamo per cliente_id che è il campo che usiamo (vedi le RLS).
    supabase.from("followup").select("*").eq("crm_cliente_id", cliente.id).order("created_at", { ascending: false })
      .then(({ data }) => { setStoria(data || []); setLoading(false); });
  }, [cliente?.id]);

  const salva = async () => {
    if (!motivo.trim()) { alert("Inserisci almeno il motivo della nota"); return; }
    setSaving(true);
    const payload = {
      crm_cliente_id: cliente.id,
      data_contatto: new Date().toISOString().split("T")[0],
      motivo: motivo.trim(),
      esito: esito.trim() || null,
      prossima_azione: prossimaAzione.trim() || null,
    };
    const { data, error } = await supabase.from("followup").insert(payload).select().single();
    if (error) { alert("Errore: " + error.message); setSaving(false); return; }
    setStoria(p => [data, ...p]);
    setMotivo(""); setEsito(""); setProssimaAzione("");
    setShowAdd(false);
    setSaving(false);
  };

  const elimina = async (id) => {
    if (!window.confirm("Eliminare questa nota?")) return;
    await supabase.from("followup").delete().eq("id", id);
    setStoria(p => p.filter(x => x.id !== id));
  };

  const fmtData = (s) => {
    if (!s) return "—";
    try {
      const d = typeof s === "string" && s.length === 10 ? new Date(s + "T00:00:00") : new Date(s);
      return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "2-digit" });
    } catch (_) { return s; }
  };

  if (loading) return <div style={C({padding:"10px 14px"})}><div style={{fontSize:11,color:K.muted,letterSpacing:1}}>NOTE / FOLLOW-UP</div><div style={{fontSize:11,color:K.muted,marginTop:4}}>Caricamento…</div></div>;

  if (showAdd) return (
    <div style={C()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontWeight:500,fontSize:13}}>📝 NUOVA NOTA</div>
        <button onClick={() => { setShowAdd(false); setMotivo(""); setEsito(""); setProssimaAzione(""); }} style={B("ghost",{padding:"4px 10px",fontSize:11})}>Annulla</button>
      </div>
      <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Motivo *</label>
      <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Es. Chiamata di controllo, cliente perplesso, problema con seduta…"/>
      <div style={{height:8}}/>
      <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Esito (opz.)</label>
      <input value={esito} onChange={e => setEsito(e.target.value)} placeholder="Es. Si è rasserenato, ha cambiato idea, ha chiesto rinvio…"/>
      <div style={{height:8}}/>
      <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Prossima azione (opz.)</label>
      <input value={prossimaAzione} onChange={e => setProssimaAzione(e.target.value)} placeholder="Es. Richiamare lunedì, mandare offerta, fissare BIA…"/>
      <button onClick={salva} disabled={saving} style={{...B("gold"),width:"100%",padding:"12px",marginTop:14}}>{saving ? "Salvataggio…" : "💾 Salva nota"}</button>
    </div>
  );

  return (
    <div style={C()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,color:K.muted,letterSpacing:1}}>NOTE / FOLLOW-UP {storia.length > 0 && `(${storia.length})`}</div>
        <button onClick={() => setShowAdd(true)} style={B("gold",{padding:"5px 10px",fontSize:11})}>+ Nota</button>
      </div>
      {storia.length === 0 ? <div style={{fontSize:12,color:K.muted}}>Nessuna nota registrata</div> : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {storia.slice(0, 5).map(n => (
            <div key={n.id} style={{background:"#0e0e0e",borderRadius:8,padding:"10px 12px",border:`1px solid ${K.border}`,position:"relative"}}>
              <div style={{fontSize:10,color:K.muted,marginBottom:4,letterSpacing:0.5}}>{fmtData(n.data_contatto || n.created_at)}</div>
              <div style={{fontSize:13,color:K.white,fontWeight:500}}>{n.motivo}</div>
              {n.esito && <div style={{fontSize:12,color:K.mutedLight,marginTop:3}}><span style={{color:K.muted}}>Esito: </span>{n.esito}</div>}
              {n.prossima_azione && <div style={{fontSize:12,color:K.gold,marginTop:3}}><span style={{color:K.muted}}>→ </span>{n.prossima_azione}</div>}
              <button onClick={() => elimina(n.id)} style={{position:"absolute",top:8,right:8,background:"none",border:"none",color:K.muted,cursor:"pointer",fontSize:13}}>×</button>
            </div>
          ))}
          {storia.length > 5 && <div style={{fontSize:11,color:K.muted,textAlign:"center"}}>+ {storia.length - 5} note più vecchie</div>}
        </div>
      )}
    </div>
  );
}

/* ─── DOCUMENTI CLIENTE (cert. medico + iscrizione, con AI Vision) ─── */
function ClienteDocumenti({ cliente, onSaved }) {
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState("certificato_medico");
  const [aiLoading, setAiLoading] = useState(false);
  const [estratto, setEstratto] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const fmtIT = (s) => s ? new Date(s).toLocaleDateString("it-IT") : "—";
  const giorniA = (d) => { if (!d) return Infinity; return Math.floor((new Date(d) - new Date()) / 86400000); };

  const certG = giorniA(cliente?.scadenza_certificato_medico);
  const iscG  = giorniA(cliente?.scadenza_iscrizione);
  const colCert = certG === Infinity ? K.muted : certG < 0 ? K.danger : certG <= 30 ? K.gold : K.success;
  const colIsc  = iscG === Infinity ? K.muted : iscG < 0 ? K.danger : iscG <= 30 ? K.gold : K.success;

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert("File troppo grande (max 8MB)"); e.target.value = ""; return; }
    setAiLoading(true);
    setEstratto(null);
    try {
      const reader = new FileReader();
      const b64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve((reader.result || "").split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const r = await fetch("/api/documento-vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: b64, mediaType: file.type, tipo }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { alert("Errore IA: " + (j.error || r.status)); setAiLoading(false); e.target.value = ""; return; }
      setEstratto({ tipo: j.tipo_rilevato || tipo, ...j.dati });
    } catch (err) {
      alert("Errore: " + err.message);
    }
    setAiLoading(false);
    e.target.value = "";
  };

  const salva = async () => {
    if (!estratto) return;
    const tipoFinale = estratto.tipo === "iscrizione" ? "iscrizione" : "certificato_medico";
    const patch = {};
    if (tipoFinale === "certificato_medico") {
      patch.scadenza_certificato_medico = estratto.data_scadenza || null;
    } else {
      patch.scadenza_iscrizione = estratto.data_scadenza || null;
    }
    if (estratto.note) {
      patch.note = ((cliente.note || "") + (cliente.note ? "\n\n" : "") + `[${tipoFinale === "certificato_medico" ? "Cert. medico" : "Iscrizione"}] ` + estratto.note).slice(0, 2000);
    }
    const { error } = await supabase.from("clienti").update(patch).eq("id", cliente.id);
    if (error) { alert("Errore salvataggio: " + error.message); return; }
    setSavedAt(new Date());
    setEstratto(null);
    setShowForm(false);
    if (onSaved) onSaved(patch);
    setTimeout(() => setSavedAt(null), 4000);
  };

  if (showForm) return (
    <div style={C()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontWeight:500,fontSize:13}}>📄 AGGIORNA DOCUMENTO</div>
        <button onClick={() => { setShowForm(false); setEstratto(null); }} style={B("ghost",{padding:"4px 10px",fontSize:11})}>Annulla</button>
      </div>

      <div style={{marginBottom:10}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Tipo documento</label>
        <select value={tipo} onChange={e => setTipo(e.target.value)} disabled={!!estratto}>
          <option value="certificato_medico">Certificato medico</option>
          <option value="iscrizione">Tessera di iscrizione</option>
        </select>
      </div>

      {!estratto && (
        <div style={{padding:"12px",background:K.goldBg,border:`1px solid ${K.goldBorder}`,borderRadius:8,marginBottom:10}}>
          <div style={{fontSize:11,color:K.gold,fontWeight:600,marginBottom:6,letterSpacing:1}}>🤖 IA — ESTRAZIONE AUTOMATICA</div>
          <div style={{fontSize:11,color:K.mutedLight,marginBottom:10,lineHeight:1.5}}>
            Carica una foto del documento (anche storta o sgranata): l'IA estrae nome, date e validità. Tempo: ~3 secondi.
          </div>
          <label style={{...B("gold"),display:"block",textAlign:"center",cursor:aiLoading?"wait":"pointer",padding:"10px",fontSize:12,opacity:aiLoading?0.6:1}}>
            {aiLoading ? "⏳ Analisi in corso..." : "📷 Carica foto o PDF"}
            <input type="file" accept="image/*,application/pdf" onChange={onFileSelected} disabled={aiLoading} style={{display:"none"}}/>
          </label>
        </div>
      )}

      {estratto && (
        <div style={{padding:"12px",background:"#0e0e0e",border:`1px solid ${K.border}`,borderRadius:8,marginBottom:10}}>
          <div style={{fontSize:11,color:K.success,fontWeight:600,marginBottom:8,letterSpacing:1}}>✓ DATI ESTRATTI — verifica e salva</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:6,fontSize:12}}>
            {estratto.nome && <div><span style={{color:K.muted}}>Nome: </span><span style={{color:K.white}}>{estratto.nome} {estratto.cognome||""}</span></div>}
            <div><span style={{color:K.muted}}>Tipo rilevato: </span><span style={{color:K.gold}}>{estratto.tipo === "iscrizione" ? "Tessera iscrizione" : estratto.tipo === "certificato_medico" ? "Certificato medico" : "—"}</span></div>
            {estratto.data_emissione && <div><span style={{color:K.muted}}>Emissione: </span><span style={{color:K.white}}>{fmtIT(estratto.data_emissione)}</span></div>}
            <div><span style={{color:K.muted}}>Scadenza: </span><span style={{color:estratto.data_scadenza?K.gold:K.danger,fontWeight:600}}>{estratto.data_scadenza ? fmtIT(estratto.data_scadenza) : "non trovata"}</span></div>
            {estratto.tipo_certificato && <div><span style={{color:K.muted}}>Categoria: </span><span style={{color:K.white}}>{estratto.tipo_certificato}</span></div>}
            {estratto.numero_tessera && <div><span style={{color:K.muted}}>N° tessera: </span><span style={{color:K.white}}>{estratto.numero_tessera}</span></div>}
            {estratto.note && <div style={{marginTop:4,padding:"6px 8px",background:"#0a0a0a",borderRadius:4,fontStyle:"italic",color:K.mutedLight,fontSize:11}}>{estratto.note}</div>}
          </div>
          {!estratto.data_scadenza && <div style={{fontSize:11,color:K.danger,marginTop:8}}>⚠️ Senza data scadenza non posso aggiornare il cliente. Riprova con una foto migliore.</div>}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={() => setEstratto(null)} style={{...B("ghost",{flex:1,padding:"10px",fontSize:12})}}>Scarta</button>
            <button onClick={salva} disabled={!estratto.data_scadenza} style={{...B("gold",{flex:1,padding:"10px",fontSize:12,opacity:estratto.data_scadenza?1:0.5})}}>💾 Salva nel CRM</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={C()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,color:K.muted,letterSpacing:1}}>DOCUMENTI</div>
        <button onClick={() => setShowForm(true)} style={B("gold",{padding:"5px 10px",fontSize:11})}>📷 Aggiorna</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <div style={{background:"#0e0e0e",borderRadius:8,padding:"10px",border:`1px solid ${K.border}`}}>
          <div style={{fontSize:10,color:K.muted,marginBottom:4,letterSpacing:1}}>CERT. MEDICO</div>
          <div style={{fontSize:13,fontWeight:600,color:colCert}}>{fmtIT(cliente?.scadenza_certificato_medico)}</div>
          {cliente?.scadenza_certificato_medico && <div style={{fontSize:10,color:colCert,marginTop:2}}>{certG < 0 ? `Scaduto da ${Math.abs(certG)}gg` : certG <= 30 ? `Scade tra ${certG}gg` : `Valido ancora ${certG}gg`}</div>}
        </div>
        <div style={{background:"#0e0e0e",borderRadius:8,padding:"10px",border:`1px solid ${K.border}`}}>
          <div style={{fontSize:10,color:K.muted,marginBottom:4,letterSpacing:1}}>ISCRIZIONE</div>
          <div style={{fontSize:13,fontWeight:600,color:colIsc}}>{fmtIT(cliente?.scadenza_iscrizione)}</div>
          {cliente?.scadenza_iscrizione && <div style={{fontSize:10,color:colIsc,marginTop:2}}>{iscG < 0 ? `Scaduta da ${Math.abs(iscG)}gg` : iscG <= 30 ? `Scade tra ${iscG}gg` : `Valida ancora ${iscG}gg`}</div>}
        </div>
      </div>
      {savedAt && <div style={{fontSize:11,color:K.success,marginTop:8,textAlign:"center"}}>✓ Aggiornato — ricarica la scheda per vedere le nuove date</div>}
    </div>
  );
}

/* ─── BIA CLIENTE (admin) ─── */
// Componente gestione BIA: lista storico, form di inserimento manuale, e AI Vision (foto/PDF).
// Trigger su DB aggiorna ultima_bia_data/prossima_bia_data del cliente.
function ClienteBia({clienteId, cliente}) {
  const [storia, setStoria] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showStoria, setShowStoria] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const emptyForm = {
    data_rilevazione: new Date().toISOString().slice(0,10),
    peso:"", altezza:"", eta:"",
    grasso_perc:"", massa_grassa_kg:"", massa_muscolare_kg:"", acqua_perc:"",
    bmi:"", metabolismo_basale:"", obiettivo:"", deficit:"", note:""
  };
  const [fb, setFb] = useState(emptyForm);
  const ub = (k,v) => setFb(p => ({...p, [k]:v}));

  // Calcolo BMI automatico
  useEffect(()=>{
    const p = parseFloat(fb.peso); const a = parseFloat(fb.altezza);
    if (p>0 && a>0) {
      const m = a>3 ? a/100 : a;
      const bmi = (p/(m*m)).toFixed(1);
      if (bmi !== fb.bmi) setFb(prev => ({...prev, bmi}));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb.peso, fb.altezza]);

  const carica = ()=>{
    if (!clienteId) { setLoading(false); return; }
    setLoading(true);
    supabase.from("bia").select("*").eq("cliente_id", clienteId)
      .order("data_rilevazione", {ascending:false})
      .order("created_at", {ascending:false})
      .then(({data})=>{ setStoria(data||[]); setLoading(false); });
  };
  useEffect(()=>{ carica();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[clienteId]);

  const num = v => (v===""||v==null) ? null : parseFloat(v);
  const int = v => (v===""||v==null) ? null : parseInt(v);

  const salvaBia = async ()=>{
    if (!fb.peso) { alert("Inserisci almeno il peso"); return; }
    const payload = {
      cliente_id: clienteId,
      data_rilevazione: fb.data_rilevazione || new Date().toISOString().slice(0,10),
      peso: num(fb.peso),
      altezza: num(fb.altezza),
      eta: int(fb.eta),
      grasso_perc: num(fb.grasso_perc),
      massa_grassa_kg: num(fb.massa_grassa_kg),
      massa_muscolare_kg: num(fb.massa_muscolare_kg),
      massa_muscolare: num(fb.massa_muscolare_kg),
      acqua_perc: num(fb.acqua_perc),
      bmi: num(fb.bmi),
      metabolismo_basale: int(fb.metabolismo_basale),
      obiettivo: fb.obiettivo||null,
      deficit: int(fb.deficit) || 0,
      note: fb.note||null,
    };
    const { data, error } = await supabase.from("bia").insert(payload).select().single();
    if (error) { alert("Errore: " + error.message); return; }
    if (data) { setStoria(p => [data, ...p]); setFb(emptyForm); setShowForm(false); setAiNote(""); }
  };

  const elimina = async (id)=>{
    if (!window.confirm("Eliminare questa rilevazione?")) return;
    await supabase.from("bia").delete().eq("id", id);
    setStoria(p => p.filter(x => x.id !== id));
  };

  // AI VISION: carica foto/PDF e popola il form
  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert("File troppo grande (max 8MB)"); return; }
    setAiLoading(true); setAiNote("");
    try {
      // legge il file in base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => { const r = reader.result; const b64 = (r||"").split(",")[1]; resolve(b64); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const fileBase64 = await base64Promise;
      const r = await fetch("/api/bia-vision", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ fileBase64, mediaType: file.type })
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { alert("Errore IA: " + (j.error||r.status)); setAiLoading(false); return; }
      const d = j.data || {};
      setFb(prev => ({
        ...prev,
        peso: d.peso != null ? String(d.peso) : prev.peso,
        altezza: d.altezza != null ? String(d.altezza) : prev.altezza,
        eta: d.eta != null ? String(d.eta) : prev.eta,
        grasso_perc: d.grasso_perc != null ? String(d.grasso_perc) : prev.grasso_perc,
        massa_grassa_kg: d.massa_grassa_kg != null ? String(d.massa_grassa_kg) : prev.massa_grassa_kg,
        massa_muscolare_kg: d.massa_muscolare_kg != null ? String(d.massa_muscolare_kg) : prev.massa_muscolare_kg,
        acqua_perc: d.acqua_perc != null ? String(d.acqua_perc) : prev.acqua_perc,
        bmi: d.bmi != null ? String(d.bmi) : prev.bmi,
        metabolismo_basale: d.metabolismo_basale != null ? String(d.metabolismo_basale) : prev.metabolismo_basale,
        obiettivo: d.obiettivo || prev.obiettivo,
        note: d.note || prev.note,
      }));
      setAiNote("✓ Dati estratti — verifica i valori e salva");
    } catch(err) {
      alert("Errore: " + err.message);
    }
    setAiLoading(false);
    e.target.value = "";
  };

  const fmtIT = s => s ? new Date(s).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "—";
  const bia = storia[0] || null;
  const prev = storia[1] || null;
  const diff = field => {
    if (!bia||!prev||bia[field]==null||prev[field]==null) return null;
    const d = bia[field] - prev[field];
    if (Math.abs(d) < 0.05) return null;
    const isFat = field === "grasso_perc";
    const col = d>0 ? (isFat?K.danger:K.success) : (isFat?K.success:K.danger);
    return <span style={{fontSize:10, color:col, marginLeft:4}}>{d>0?"+":""}{d.toFixed(1)}</span>;
  };

  if (loading) return <div style={C()}><div style={{fontSize:11,color:K.muted,letterSpacing:1}}>BIA</div><div style={{fontSize:12,color:K.muted,marginTop:6}}>Caricamento…</div></div>;

  if (showForm) return (
    <div style={C()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontWeight:500,fontSize:13}}>NUOVA RILEVAZIONE BIA</div>
        <button onClick={()=>{setShowForm(false);setFb(emptyForm);setAiNote("");}} style={B("ghost",{padding:"4px 10px",fontSize:11})}>Annulla</button>
      </div>

      {/* AI VISION UPLOAD */}
      <div style={{padding:"12px",background:K.goldBg,border:`1px solid ${K.goldBorder}`,borderRadius:8,marginBottom:14}}>
        <div style={{fontSize:11,color:K.gold,fontWeight:600,marginBottom:6,letterSpacing:1}}>🤖 IA — COMPILAZIONE AUTOMATICA</div>
        <div style={{fontSize:11,color:K.mutedLight,marginBottom:10,lineHeight:1.5}}>
          Carica una foto del referto bilancia/BIA o un PDF: l'IA estrae i numeri e compila il form per te.
        </div>
        <label style={{...B("gold"),display:"block",textAlign:"center",cursor:aiLoading?"wait":"pointer",padding:"10px",fontSize:12,opacity:aiLoading?0.6:1}}>
          {aiLoading ? "⏳ Analisi in corso..." : "📷 Carica foto o PDF"}
          <input type="file" accept="image/*,application/pdf" onChange={onFileSelected} disabled={aiLoading} style={{display:"none"}}/>
        </label>
        {aiNote && <div style={{fontSize:11,color:K.success,marginTop:8,textAlign:"center"}}>{aiNote}</div>}
      </div>

      <div style={{marginBottom:10}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Data rilevazione</label>
        <input type="date" value={fb.data_rilevazione} onChange={e=>ub("data_rilevazione",e.target.value)}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[
          ["Peso (kg) *","peso","0.1"],
          ["Altezza (cm)","altezza","0.5"],
          ["Età","eta","1"],
          ["BMI (auto)","bmi","0.1"],
          ["Grasso %","grasso_perc","0.1"],
          ["Massa grassa (kg)","massa_grassa_kg","0.1"],
          ["Massa muscolare (kg)","massa_muscolare_kg","0.1"],
          ["Acqua %","acqua_perc","0.1"],
          ["Metab. basale (kcal)","metabolismo_basale","10"],
          ["Deficit kcal/gg","deficit","10"],
        ].map(([l,k,step])=>(
          <div key={k}>
            <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>{l}</label>
            <input type="number" step={step} value={fb[k]} onChange={e=>ub(k,e.target.value)}/>
          </div>
        ))}
      </div>
      <div style={{marginTop:10}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Obiettivo</label>
        <select value={fb.obiettivo} onChange={e=>ub("obiettivo",e.target.value)}>
          <option value="">— Seleziona —</option>
          <option>Dimagrimento</option><option>Tonificazione</option><option>Massa muscolare</option><option>Mantenimento</option><option>Benessere</option>
        </select>
      </div>
      <div style={{marginTop:10}}>
        <label style={{fontSize:11,color:K.muted,display:"block",marginBottom:4}}>Note</label>
        <textarea value={fb.note} onChange={e=>ub("note",e.target.value)} rows={2}
          style={{width:"100%",background:"#111",border:`1px solid ${K.border}`,color:K.white,borderRadius:8,padding:"8px 10px",fontSize:13,fontFamily:"inherit",resize:"vertical"}}/>
      </div>
      <button onClick={salvaBia} style={{...B("gold"),width:"100%",padding:"12px",marginTop:14}}>💾 Salva BIA</button>
    </div>
  );

  if (showStoria) return (
    <div style={C()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontWeight:500,fontSize:13}}>STORICO BIA ({storia.length})</div>
        <button onClick={()=>setShowStoria(false)} style={B("ghost",{padding:"4px 10px",fontSize:11})}>← Indietro</button>
      </div>
      {storia.length===0 ? <div style={{fontSize:12,color:K.muted}}>Nessuna BIA</div> :
        storia.map(b => (
          <div key={b.id} style={{background:"#0e0e0e",border:`1px solid ${K.border}`,borderRadius:8,padding:"10px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:13,fontWeight:600,color:K.gold}}>{fmtIT(b.data_rilevazione||b.created_at)}</div>
              <button onClick={()=>elimina(b.id)} style={{background:"none",border:"none",color:K.muted,cursor:"pointer",fontSize:14}}>×</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:6,fontSize:11}}>
              {b.peso!=null && <div><span style={{color:K.muted}}>Peso </span><span style={{color:K.white}}>{b.peso}kg</span></div>}
              {b.bmi!=null && <div><span style={{color:K.muted}}>BMI </span><span style={{color:K.white}}>{b.bmi}</span></div>}
              {b.grasso_perc!=null && <div><span style={{color:K.muted}}>Grasso </span><span style={{color:K.white}}>{b.grasso_perc}%</span></div>}
              {b.massa_muscolare_kg!=null && <div><span style={{color:K.muted}}>Muscolo </span><span style={{color:K.white}}>{b.massa_muscolare_kg}kg</span></div>}
              {b.acqua_perc!=null && <div><span style={{color:K.muted}}>Acqua </span><span style={{color:K.white}}>{b.acqua_perc}%</span></div>}
              {b.metabolismo_basale!=null && <div><span style={{color:K.muted}}>Metab </span><span style={{color:K.white}}>{b.metabolismo_basale}</span></div>}
            </div>
            {b.obiettivo && <div style={{fontSize:11,marginTop:6,color:K.mutedLight}}>Obiettivo: <span style={{color:K.gold}}>{b.obiettivo}</span></div>}
            {b.note && <div style={{fontSize:11,marginTop:4,color:K.muted,fontStyle:"italic"}}>{b.note}</div>}
          </div>
        ))
      }
    </div>
  );

  return (
    <div style={C()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,color:K.muted,letterSpacing:1}}>BIA {bia && `· ultima ${fmtIT(bia.data_rilevazione||bia.created_at)}`}</div>
        <div style={{display:"flex",gap:6}}>
          {storia.length>0 && <button onClick={()=>setShowStoria(true)} style={B("ghost",{padding:"5px 10px",fontSize:11})}>Storico ({storia.length})</button>}
          <button onClick={()=>setShowForm(true)} style={B("gold",{padding:"5px 10px",fontSize:11})}>+ Nuova</button>
        </div>
      </div>
      {storia.length >= 2 && <BIATrendChart storia={storia} clienteNome={cliente ? `${cliente.nome||""} ${cliente.cognome||""}`.trim() : ""}/>}
      {!bia ? <div style={{fontSize:12,color:K.muted}}>Nessuna rilevazione BIA</div> : (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
          {[
            ["Peso", bia.peso!=null ? bia.peso+" kg" : null, diff("peso")],
            ["BMI", bia.bmi||null, diff("bmi")],
            ["Grasso", bia.grasso_perc!=null ? bia.grasso_perc+"%" : null, diff("grasso_perc")],
            ["Muscolare", bia.massa_muscolare_kg!=null ? bia.massa_muscolare_kg+" kg" : (bia.massa_muscolare!=null ? bia.massa_muscolare+" kg" : null), diff("massa_muscolare_kg")],
            ["Acqua", bia.acqua_perc!=null ? bia.acqua_perc+"%" : null, diff("acqua_perc")],
            ["Metab.", bia.metabolismo_basale||null, null],
          ].filter(r => r[1]!=null).map(([l,v,d])=>(
            <div key={l} style={{background:"#0e0e0e",borderRadius:8,padding:"8px 10px",border:`1px solid ${K.border}`}}>
              <div style={{fontSize:10,color:K.muted,marginBottom:2}}>{l}</div>
              <div style={{fontSize:13,fontWeight:600,color:K.gold}}>{v}{d}</div>
            </div>
          ))}
        </div>
      )}
      {bia && bia.obiettivo && (
        <div style={{fontSize:11,marginTop:10,color:K.mutedLight}}>
          Obiettivo: <span style={{color:K.gold}}>{bia.obiettivo}</span>
        </div>
      )}
    </div>
  );
}

/* ─── AGENDA ADMIN ─── */
function Agenda() {
  const [pren, setPren] = useState([]);
  const [clienti, setClienti] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [day, setDay] = useState(today.toISOString().split("T")[0]);
  const [mode, setMode] = useState("calendar"); // "calendar" | "settimana"

  useEffect(() => {
    Promise.all([
      supabase.from("prenotazioni").select("*").eq("stato", "confermata"),
      supabase.from("clienti").select("id,nome,cognome,user_id"),
    ]).then(([{ data: p }, { data: c }]) => { setPren(p || []); setClienti(c || []); setLoading(false); });
  }, []);

  const dayP = pren.filter(p => p.data === day).sort((a, b) => (a.ora || "").localeCompare(b.ora || ""));
  const getNome = (uid) => { const c = clienti.find(x => x.id === uid); return c ? `${c.nome} ${c.cognome}` : "Cliente"; };

  const cancella = async (id) => {
    if (!window.confirm("Cancellare questa prenotazione?")) return;
    await supabase.from("prenotazioni").update({ stato: "cancellata" }).eq("id", id);
    setPren(p => p.filter(x => x.id !== id));
  };

  // Costruisco la griglia del mese (settimane lunedì-domenica)
  const buildMonthGrid = (firstOfMonth) => {
    const grid = [];
    const start = new Date(firstOfMonth);
    // Trova il lunedì della prima settimana
    let offset = (start.getDay() + 6) % 7; // 0=lunedì
    start.setDate(start.getDate() - offset);
    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start);
        dt.setDate(start.getDate() + w * 7 + d);
        week.push(dt);
      }
      grid.push(week);
    }
    return grid;
  };

  const grid = buildMonthGrid(viewMonth);
  const monthLabel = viewMonth.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const cambiaMese = (delta) => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));

  const fmtData = (d) => d.toISOString().split("T")[0];
  const countDay = (d) => pren.filter(p => p.data === fmtData(d)).length;
  const isToday = (d) => fmtData(d) === today.toISOString().split("T")[0];
  const isSelected = (d) => fmtData(d) === day;
  const isCurrentMonth = (d) => d.getMonth() === viewMonth.getMonth();

  if (loading) return <Spinner/>;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:16 }}>Agenda</div>
          <div style={{ fontSize:12, color:K.muted, marginTop:2 }}>{pren.length} sessioni totali confermate</div>
        </div>
        <div style={{ display:"flex", gap:4, padding:3, background:"#0e0e0e", borderRadius:8, border:`1px solid ${K.border}` }}>
          {[["calendar","📅 Mese"],["settimana","📆 Settimana"]].map(([k,lab])=>(
            <button key={k} onClick={()=>setMode(k)} style={{
              background: mode===k ? K.goldBg : "transparent",
              border: `1px solid ${mode===k ? K.gold : "transparent"}`,
              color: mode===k ? K.gold : K.mutedLight,
              borderRadius: 6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit", fontWeight: mode===k?600:400
            }}>{lab}</button>
          ))}
        </div>
      </div>

      {mode === "calendar" && (
        <div style={C({padding:"12px"})}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <button onClick={()=>cambiaMese(-1)} style={B("ghost",{padding:"5px 12px",fontSize:13})}>◀</button>
            <div style={{ fontSize:14, fontWeight:600, color:K.gold, textTransform:"capitalize" }}>{monthLabel}</div>
            <button onClick={()=>cambiaMese(1)} style={B("ghost",{padding:"5px 12px",fontSize:13})}>▶</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:3 }}>
            {["L","M","M","G","V","S","D"].map((g,i)=>(
              <div key={i} style={{ textAlign:"center", fontSize:10, color:K.muted, padding:"4px 0", letterSpacing:1 }}>{g}</div>
            ))}
            {grid.flat().map((d,i)=>{
              const cnt = countDay(d);
              const inMonth = isCurrentMonth(d);
              const sel = isSelected(d);
              const tod = isToday(d);
              return (
                <div key={i} onClick={()=>setDay(fmtData(d))} style={{
                  aspectRatio:"1/1",
                  background: sel ? K.goldBg : (tod ? "#1a1408" : "#0e0e0e"),
                  border: `1px solid ${sel ? K.gold : (tod ? K.goldBorder : K.border)}`,
                  borderRadius: 6,
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  cursor:"pointer", opacity: inMonth ? 1 : 0.35,
                  position:"relative",
                  minHeight: 38,
                }}>
                  <div style={{ fontSize:13, fontWeight: sel ? 700 : (tod ? 600 : 500), color: sel ? K.gold : (tod ? K.gold : (inMonth ? K.white : K.muted)) }}>{d.getDate()}</div>
                  {cnt > 0 && (
                    <div style={{
                      position:"absolute", bottom:3,
                      background: K.gold, color:"#080808",
                      fontSize: 9, fontWeight:700,
                      borderRadius: 8, padding:"1px 5px", minWidth:14, textAlign:"center"
                    }}>{cnt}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "settimana" && (
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8, marginBottom:14 }}>
          {Array.from({length: 14}).map((_, i)=>{
            const dt = new Date(); dt.setDate(today.getDate() + i);
            if (dt.getDay() === 0) return null;
            const k = fmtData(dt);
            const isSel = k === day;
            const cnt = pren.filter(p => p.data === k).length;
            return (
              <div key={k} onClick={()=>setDay(k)} style={{flexShrink:0,background:isSel?K.goldBg:"#111",border:`1px solid ${isSel?K.gold:K.border}`,borderRadius:10,padding:"8px 10px",cursor:"pointer",textAlign:"center",minWidth:48}}>
                <div style={{fontSize:9,color:isSel?K.gold:K.muted}}>{dt.toLocaleDateString("it-IT",{weekday:"short"}).slice(0,3).toUpperCase()}</div>
                <div style={{fontSize:16,fontWeight:600,color:isSel?K.gold:K.white}}>{dt.getDate()}</div>
                {cnt>0 && <div style={{width:5,height:5,borderRadius:"50%",background:K.gold,margin:"2px auto 0"}}/>}
              </div>
            );
          })}
        </div>
      )}

      {/* Dettaglio giorno selezionato */}
      <div style={{ fontSize:11, color:K.muted, margin:"14px 0 10px", letterSpacing:0.5 }}>
        {fmtDate(day).toUpperCase()} — {dayP.length} {dayP.length === 1 ? "SESSIONE" : "SESSIONI"}
      </div>
      {dayP.length === 0 ? <div style={C({textAlign:"center",padding:"2rem",color:K.muted,fontSize:13})}>Nessuna prenotazione</div> :
        dayP.map(p => (
          <div key={p.id} style={C()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontWeight:600, fontSize:15, color:K.gold }}>{p.ora}</span>
                  <span style={Tag(p.tipo === "EMS" ? "#6BBEFC" : "#B88EFF", p.tipo === "EMS" ? "#08101e" : "#100e1e")}>{p.tipo}</span>
                </div>
                <div style={{ fontSize:13, color:K.mutedLight }}>{getNome(p.user_id)}</div>
              </div>
              <button onClick={() => cancella(p.id)} style={B("danger",{padding:"6px 10px",fontSize:12})}>✕</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function FollowUp() {
  const [clienti,setClienti]=useState([]);
  const [followups,setFollowups]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [f,setF]=useState({cliente_id:"",data_contatto:"",motivo:"",esito:"",prossima_azione:""});
  const u=(k,v)=>setF(p=>({...p,[k]:v}));

  useEffect(()=>{
    Promise.all([
      supabase.from("clienti").select("id,nome,cognome,telefono,user_id"),
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
          {cl?.telefono&&<a href={`https://api.whatsapp.com/send?phone=39${cl.telefono}`} target="_blank" rel="noreferrer" style={{...B("success",{display:"inline-block",marginTop:10,padding:"7px 12px",fontSize:12,textDecoration:"none"})}}>💬 WhatsApp</a>}
        </div>
      );})}
    </div>
  );
}
