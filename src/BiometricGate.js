/**
 * BiometricGate — Login rapido con Face ID / impronta tramite WebAuthn (Passkey)
 *
 * Come funziona, in parole semplici:
 *   1. Dopo il primo login con email+password, l'app chiede se vuoi attivare
 *      l'accesso rapido. Tu accetti, il browser crea una "passkey" sul tuo
 *      dispositivo (legata a Face ID / impronta / Windows Hello).
 *   2. Il browser e Supabase tengono attiva la sessione per giorni/settimane.
 *   3. La prossima volta che apri l'app, ti chiede solo "Sblocca con Face ID".
 *      Tocco/sguardo, e sei dentro.
 *
 * Sicurezza:
 *   - La passkey e' legata al dispositivo. Cambi telefono → devi rifare login
 *     con email+password e riattivare.
 *   - Sotto sotto, la sessione Supabase resta il vero pilastro di auth. Il
 *     biometrico e' un "lock" UI in piu'.
 *   - WebAuthn richiede HTTPS (Vercel ok, localhost ok in dev).
 */

import { useState, useEffect, useCallback } from "react";

const LS_KEY_CRED = "kendo_passkey_cred_id";   // Base64 credential id
const LS_KEY_USER = "kendo_passkey_user_email";
const LS_KEY_ENROLL_DECLINED = "kendo_passkey_enroll_declined";

const K = {
  gold:"#D4A843", goldBg:"#141008", goldBorder:"#2e2510",
  black:"#080808", card:"#111", border:"#1e1e1e", borderMid:"#2a2a2a",
  white:"#F5F5F5", muted:"#666", mutedLight:"#bbb",
  success:"#2a9d6f", successBg:"#081a12", successBorder:"#0f3020",
  danger:"#c0392b", dangerBg:"#160808", dangerBorder:"#2e1010",
};

/* ─── Util base64 ↔ ArrayBuffer ─── */
const b64ToBuf = (s) => {
  const bin = atob(s.replace(/-/g,"+").replace(/_/g,"/"));
  const buf = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
};
const bufToB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i=0;i<bytes.byteLength;i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const randomBytes = (n=32) => {
  const a = new Uint8Array(n);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return a.buffer;
};

/* ─── API pubbliche ─── */
export const isBiometricSupported = () =>
  typeof window !== "undefined" &&
  !!window.PublicKeyCredential &&
  typeof navigator.credentials !== "undefined" &&
  typeof navigator.credentials.create === "function";

export const hasEnrolledPasskey = () => !!localStorage.getItem(LS_KEY_CRED);
export const getEnrolledEmail   = () => localStorage.getItem(LS_KEY_USER);
export const hasDeclinedEnroll  = () => !!localStorage.getItem(LS_KEY_ENROLL_DECLINED);
export const clearEnrollment    = () => {
  localStorage.removeItem(LS_KEY_CRED);
  localStorage.removeItem(LS_KEY_USER);
  localStorage.removeItem(LS_KEY_ENROLL_DECLINED);
};

async function enrollPasskey(userEmail) {
  if (!isBiometricSupported()) throw new Error("Biometrico non supportato dal browser");
  const userIdBuf = new TextEncoder().encode(userEmail).buffer;
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Kendo App" },
      user: { id: userIdBuf, name: userEmail, displayName: userEmail },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    }
  });
  if (!cred) throw new Error("Nessuna passkey creata");
  localStorage.setItem(LS_KEY_CRED, bufToB64(cred.rawId));
  localStorage.setItem(LS_KEY_USER, userEmail);
  localStorage.removeItem(LS_KEY_ENROLL_DECLINED);
  return true;
}

async function verifyPasskey() {
  if (!isBiometricSupported()) throw new Error("Biometrico non supportato");
  const credId = localStorage.getItem(LS_KEY_CRED);
  if (!credId) throw new Error("Nessuna passkey registrata");
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: b64ToBuf(credId), type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    }
  });
  if (!assertion) throw new Error("Verifica fallita");
  return true;
}

/* ─── COMPONENTE: Schermata Sblocco ─── */
export function BiometricUnlock({ onUnlocked, onUsePassword }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const email = getEnrolledEmail() || "";

  const tryUnlock = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      await verifyPasskey();
      onUnlocked();
    } catch(e) {
      setErr("Sblocco non riuscito. Riprova o usa la password.");
    }
    setBusy(false);
  }, [onUnlocked]);

  // Tentativo automatico all'apertura — UX più fluida
  useEffect(()=>{
    // Tentativo SOLO dopo gesture utente, in molti browser il prompt richiede tap.
    // Quindi NON triggero automaticamente, mostro solo il bottone.
  }, []);

  return (
    <div style={{maxWidth:390,margin:"0 auto",padding:24,minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",background:K.black,color:K.white,fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:84,height:84,borderRadius:"50%",border:`2px solid ${K.gold}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,marginBottom:24,color:K.gold}}>🔒</div>
      <div style={{fontSize:20,fontWeight:600,marginBottom:6,letterSpacing:2,color:K.gold}}>KENDO</div>
      <div style={{fontSize:13,color:K.muted,marginBottom:6,textAlign:"center"}}>Accesso rapido</div>
      {email&&<div style={{fontSize:11,color:K.muted,marginBottom:24,textAlign:"center"}}>{email}</div>}

      {err && <div style={{background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:K.danger,marginBottom:14,maxWidth:300,textAlign:"center"}}>{err}</div>}

      <button onClick={tryUnlock} disabled={busy} style={{
        background:K.gold,color:"#080808",border:"none",borderRadius:10,
        padding:"16px 28px",fontSize:15,fontWeight:600,cursor:"pointer",
        fontFamily:"inherit",width:"100%",maxWidth:300,marginBottom:12,
        opacity:busy?0.7:1
      }}>{busy?"Sblocco in corso…":"🔓 Sblocca con Face ID / Impronta"}</button>

      <button onClick={onUsePassword} style={{
        background:"transparent",color:K.mutedLight,border:`1px solid ${K.border}`,
        borderRadius:10,padding:"12px 20px",fontSize:13,cursor:"pointer",
        fontFamily:"inherit",width:"100%",maxWidth:300,marginBottom:24
      }}>Usa email e password</button>

      <button onClick={()=>{if(window.confirm("Disattivare l'accesso rapido su questo dispositivo?")){clearEnrollment();onUsePassword();}}} style={{
        background:"transparent",color:K.muted,border:"none",fontSize:11,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"
      }}>Disattiva accesso rapido</button>
    </div>
  );
}

/* ─── COMPONENTE: Prompt di Enrollment dopo login ─── */
export function BiometricEnrollPrompt({ userEmail, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const accetta = async () => {
    setBusy(true); setErr("");
    try {
      await enrollPasskey(userEmail);
      onDone(true);
    } catch(e) {
      setErr("Non riesco ad attivare il biometrico: " + (e?.message||"errore sconosciuto"));
      setBusy(false);
    }
  };

  const rifiuta = () => {
    localStorage.setItem(LS_KEY_ENROLL_DECLINED, "1");
    onDone(false);
  };

  return (
    <div style={{maxWidth:390,margin:"0 auto",padding:24,minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",background:K.black,color:K.white,fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:72,height:72,borderRadius:"50%",background:K.goldBg,border:`2px solid ${K.gold}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:20}}>👆</div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:8,textAlign:"center"}}>Accesso più rapido?</div>
      <div style={{fontSize:13,color:K.mutedLight,marginBottom:24,textAlign:"center",lineHeight:1.6,maxWidth:320}}>
        Attiva Face ID / impronta digitale per entrare in Kendo senza scrivere la password ogni volta.
      </div>

      {err && <div style={{background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:K.danger,marginBottom:14,maxWidth:320,textAlign:"center"}}>{err}</div>}

      <button onClick={accetta} disabled={busy} style={{
        background:K.gold,color:"#080808",border:"none",borderRadius:10,
        padding:"14px 24px",fontSize:14,fontWeight:600,cursor:"pointer",
        fontFamily:"inherit",width:"100%",maxWidth:300,marginBottom:10,
        opacity:busy?0.7:1
      }}>{busy?"Configurazione…":"✓ Attiva accesso rapido"}</button>

      <button onClick={rifiuta} style={{
        background:"transparent",color:K.mutedLight,border:`1px solid ${K.border}`,
        borderRadius:10,padding:"12px 18px",fontSize:13,cursor:"pointer",
        fontFamily:"inherit",width:"100%",maxWidth:300
      }}>Non ora</button>

      <div style={{fontSize:10,color:K.muted,marginTop:16,maxWidth:300,textAlign:"center",lineHeight:1.5}}>
        Funziona solo su questo dispositivo. Cambiando telefono dovrai rifare login con email e password.
      </div>
    </div>
  );
}
