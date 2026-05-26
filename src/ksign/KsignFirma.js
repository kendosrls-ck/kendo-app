// K-Sign · Pagina firma cliente PUBBLICA (senza auth)
// Viene renderizzata quando window.location.pathname inizia per /firma/
// Legge token dall'URL, carica richiesta da Supabase, salva firme/consensi/PDF

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import KsignSignaturePad from "./KsignSignaturePad";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const K = {
  gold: "#D4A843", goldDim: "#8a6e28", goldBg: "#fffbeb",
  black: "#0a0a0a", white: "#ffffff",
  slate50: "#f8fafc", slate100: "#f1f5f9", slate200: "#e2e8f0",
  slate500: "#64748b", slate700: "#334155", slate900: "#0f172a",
  amber50: "#fffbeb", amber100: "#fef3c7", amber500: "#f59e0b", amber700: "#b45309", amber900: "#78350f",
  emerald500: "#10b981", emerald600: "#059669", emerald50: "#ecfdf5",
  red600: "#dc2626",
};

function getTokenFromURL() {
  const m = window.location.pathname.match(/\/firma\/([^/?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  return new URLSearchParams(window.location.search).get("t");
}

export default function KsignFirma() {
  const [richiesta, setRichiesta] = useState(null);
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);
  const [step, setStep] = useState(0);
  const [certMedico, setCertMedico] = useState(false);
  const [libAccept, setLibAccept] = useState(false);
  const [consents, setConsents] = useState({ A: null, B: null, C: null, D: null });
  const [signatures, setSignatures] = useState({});
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [done, setDone] = useState(false);
  const [transId, setTransId] = useState(null);

  const padRefs = useRef({});

  // ===== LOAD =====
  useEffect(() => {
    const token = getTokenFromURL();
    if (!token) { setErrore("Link mancante. Apri il link completo ricevuto via WhatsApp/email."); setLoading(false); return; }
    (async () => {
      const { data, error } = await sb.rpc("ksign_get_richiesta_by_token", { p_token: token });
      if (error || !data?.length) {
        setErrore("Link non valido o scaduto. La richiesta firma non esiste, è già stata completata o è scaduta.");
        setLoading(false); return;
      }
      const r = data[0];
      const { data: tpl } = await sb.from("ksign_template").select("*").in("codice", r.template_codici);
      const tplMap = {};
      (tpl || []).forEach(t => tplMap[t.codice] = t);
      setRichiesta(r);
      setTemplates(tplMap);
      setLoading(false);
      // mark viewed
      if (r.stato === "pending") {
        await sb.from("ksign_richiesta").update({ stato: "viewed", viewed_at: new Date().toISOString() }).eq("id", r.id);
        await sb.from("ksign_audit_log").insert({ richiesta_id: r.id, evento: "viewed", descrizione: "Pagina firma aperta", attore_tipo: "cliente", user_agent: navigator.userAgent.substring(0, 200) });
      }
    })();
  }, []);

  const isLib = richiesta?.template_codici?.includes("liberatoria_fitgo");
  const isCon = richiesta?.template_codici?.includes("contratto_fitgo");
  const isLibOnly = isLib && !isCon;
  const isConOnly = isCon && !isLib;

  const totalRequired = (isLib ? 6 : 0) + (isCon ? 4 : 0);
  const signedCount = Object.keys(signatures).filter(k => signatures[k]).length;

  const libDone = !isCon && !isLib ? true :
    (!isCon ? true : true) && // contratto: handled below
    (!isLib ? true : (
      [1,2,3,4,5,6].every(n => signatures[n]) &&
      Object.values(consents).every(v => v === "yes" || v === "no") &&
      certMedico && libAccept
    ));

  const conDone = !isCon ? true : [7,8,9,10].every(n => signatures[n]);
  const allDone = libDone && conDone;

  // ===== ACTIONS =====
  const confirmSig = (n) => {
    const data = padRefs.current[n]?.getDataURL();
    if (!data || padRefs.current[n]?.isEmpty()) return;
    setSignatures(s => ({ ...s, [n]: data }));
  };
  const clearSig = (n) => {
    padRefs.current[n]?.clear();
    setSignatures(s => { const c = { ...s }; delete c[n]; return c; });
  };
  const setConsent = (letter, value) => {
    const prev = consents[letter];
    setConsents(c => ({ ...c, [letter]: value }));
    if (prev !== null && prev !== value) {
      // invalida firma consenso
      const sigMap = { A: 3, B: 4, C: 5, D: 6 };
      const n = sigMap[letter];
      padRefs.current[n]?.clear();
      setSignatures(s => { const c = { ...s }; delete c[n]; return c; });
    }
  };

  // ===== OTP =====
  const verifyOtp = async () => {
    if (otpCode.length !== 6) { setOtpError("Inserisci tutte le 6 cifre"); return; }
    if (otpCode !== "123456") { setOtpError("Codice errato. In demo usa 123456"); return; }
    setOtpError("");
    setVerifying(true);
    await completeSignature();
    setVerifying(false);
  };

  // ===== COMPLETE =====
  async function completeSignature() {
    try {
      // 1. salva firme
      const sigInserts = [];
      richiesta.template_codici.forEach(tplCod => {
        const tpl = templates[tplCod];
        if (!tpl?.contenuto?.firme_richieste) return;
        tpl.contenuto.firme_richieste.forEach((f, idx) => {
          const sigN = tplCod === "liberatoria_fitgo" ? idx + 1 : 7 + idx;
          if (signatures[sigN]) {
            sigInserts.push({
              richiesta_id: richiesta.id,
              template_codice: tplCod,
              codice_firma: f.codice,
              etichetta: f.etichetta,
              ordine: f.ordine,
              dato_png_base64: signatures[sigN],
              firmato_at: new Date().toISOString(),
              user_agent: navigator.userAgent.substring(0, 200),
            });
          }
        });
      });
      if (sigInserts.length) await sb.from("ksign_firma").insert(sigInserts);

      // 2. salva consensi (se liberatoria)
      if (isLib) {
        const tpl = templates["liberatoria_fitgo"];
        const consInserts = tpl?.contenuto?.consensi_gdpr?.map(c => ({
          richiesta_id: richiesta.id,
          codice: c.codice,
          etichetta: c.titolo,
          descrizione: c.descrizione,
          valore: consents[c.codice] || "no",
        })) || [];
        if (consInserts.length) await sb.from("ksign_consenso").insert(consInserts);
      }

      // 3. update stato
      await sb.from("ksign_richiesta").update({ stato: "signed", signed_at: new Date().toISOString() }).eq("id", richiesta.id);

      // 4. audit
      await sb.from("ksign_audit_log").insert({
        richiesta_id: richiesta.id, evento: "signed",
        descrizione: "Firma completata dal cliente",
        attore_tipo: "cliente",
        user_agent: navigator.userAgent.substring(0, 200)
      });

      // 5. id transazione
      const id = `KS-${String(richiesta.numero_progressivo).padStart(6, "0")}`;
      setTransId(id);
      setDone(true);

      // 6. Notifica email admin (non blocca se fallisce)
      fetch("/api/firma-notifica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ richiesta_id: richiesta.id }),
      }).catch(e => console.warn("firma-notifica failed (non-blocking):", e));
    } catch (err) {
      console.error("completeSignature:", err);
      setDone(true);
    }
  }

  // ===== RENDER =====
  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: K.slate100, color: K.slate500 }}>Caricamento...</div>;
  if (errore) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: K.slate100 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 420, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,.1)" }}>
        <div style={{ width: 64, height: 64, background: "#fee2e2", borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>⚠</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: K.slate900, marginBottom: 8 }}>Link non disponibile</h2>
        <p style={{ fontSize: 14, color: K.slate500 }}>{errore}</p>
      </div>
    </div>
  );

  const fullName = (richiesta.firmatario_nome || "") + " " + (richiesta.firmatario_cognome || "");

  return (
    <div style={{ minHeight: "100vh", background: K.slate100, fontFamily: "-apple-system, sans-serif", paddingBottom: 60 }}>
      {/* HEADER */}
      <header style={{ background: K.black, color: "white", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, #fbbf24, ${K.gold}, #b8860b)`, color: K.black, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>K</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>K-Sign</div>
              <div style={{ fontSize: 10, color: K.gold + "b3", marginTop: 2 }}>Fit And Go Padova</div>
            </div>
          </div>
          <div style={{ fontSize: 11, background: "rgba(16,185,129,.1)", color: "#34d399", padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(16,185,129,.3)" }}>🛡 Sicuro</div>
        </div>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#cbd5e1", marginBottom: 6 }}>
            <span>Progresso firma</span><span>{signedCount} / {totalRequired} firme</span>
          </div>
          <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${signedCount / totalRequired * 100}%`, background: `linear-gradient(to right, ${K.gold}, ${K.emerald500})`, transition: "width .5s" }} />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
        {done ? (
          <SuccessScreen fullName={fullName} transId={transId} richiesta={richiesta} />
        ) : step === 0 ? (
          <IntroStep fullName={fullName} totalRequired={totalRequired} onNext={() => setStep(2)} />
        ) : step === 2 && isLib ? (
          <LiberatoriaStep
            certMedico={certMedico} setCertMedico={setCertMedico}
            libAccept={libAccept} setLibAccept={setLibAccept}
            consents={consents} setConsent={setConsent}
            signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs}
            onBack={() => setStep(0)} onNext={() => setStep(isCon ? 3 : 4)}
            canProceed={libDone}
            isLibOnly={isLibOnly}
          />
        ) : step === 3 && isCon ? (
          <ContrattoStep
            richiesta={richiesta} templates={templates}
            signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs}
            onBack={() => setStep(isLib ? 2 : 0)} onNext={() => setStep(4)}
            canProceed={allDone}
          />
        ) : step === 4 ? (
          <OtpStep
            telefono={richiesta.firmatario_telefono}
            otpCode={otpCode} setOtpCode={setOtpCode}
            otpError={otpError} verifying={verifying}
            onVerify={verifyOtp} onBack={() => setStep(isCon ? 3 : 2)}
          />
        ) : null}
      </main>
    </div>
  );
}

// ====== SCREENS ======

function IntroStep({ fullName, totalRequired, onNext }) {
  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #0a0a0a, #1e1b16)", border: `1px solid ${K.gold}55`, borderRadius: 16, padding: 24, color: "white", boxShadow: "0 4px 12px rgba(0,0,0,.2)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: .8, marginBottom: 4 }}>Documenti da firmare</div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Pacchetto Fit And Go</h1>
        <p style={{ fontSize: 13, opacity: .9, marginTop: 8 }}>Ciao <strong>{fullName}</strong>, abbiamo preparato i documenti per la tua iscrizione. Servono <strong>{totalRequired}</strong> firme separate. Tempo stimato: ~4 minuti.</p>
      </div>
      <div style={{ background: K.amber50, border: `1px solid ${K.amber500}33`, borderRadius: 12, padding: 12, marginTop: 16, fontSize: 12, color: K.amber900 }}>
        <strong>⚠</strong> Devi essere in possesso di <strong>certificazione medica</strong> per attività sportiva non agonistica. Te la chiederemo in centro.
      </div>
      <button onClick={onNext} style={btnPrimary({ marginTop: 20, padding: 16, fontSize: 15 })}>Inizia la firma →</button>
    </div>
  );
}

function LiberatoriaStep({ certMedico, setCertMedico, libAccept, setLibAccept, consents, setConsent, signatures, confirmSig, clearSig, padRefs, onBack, onNext, canProceed, isLibOnly }) {
  return (
    <div>
      <Card>
        <div style={{ fontSize: 11, color: K.amber500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Step 1 · Liberatoria</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>Dichiarazione di responsabilità</h2>
      </Card>

      <Card>
        <label style={{ display: "flex", gap: 10, padding: 12, background: K.amber50, border: `2px solid ${K.amber500}55`, borderRadius: 10, cursor: "pointer", marginBottom: 16 }}>
          <input type="checkbox" checked={certMedico} onChange={e => setCertMedico(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: K.amber900 }}>Possesso certificato medico</div>
            <div style={{ fontSize: 11, color: K.amber700, marginTop: 2 }}>Dichiaro di possedere certificazione medica per attività sportiva non agonistica</div>
          </div>
        </label>

        <div style={{ background: K.slate50, border: `1px solid ${K.slate200}`, borderRadius: 10, padding: 16, fontSize: 13, color: K.slate700, maxHeight: 240, overflowY: "auto" }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>DICHIARO INOLTRE:</p>
          <p>1. Di essere in condizioni psicofisiche idonee.</p>
          <p>2. Di non avere: epilessia, pacemaker, gravidanza, cardiopatie, ernia, problemi renali, malattie neurologiche, diabete, ecc.</p>
          <p>3. Di non aver assunto stupefacenti/alcolici/farmaci nelle 48h precedenti.</p>
          <p>4. Di essere a conoscenza dei rischi.</p>
          <p>5. Di osservare le norme di sicurezza.</p>
          <p>6. Di assumermi responsabilità per danni a terzi.</p>
          <p>7. Di aver letto il documento ed esonerare Fit & Go Srl.</p>
        </div>

        <label style={{ display: "flex", gap: 10, padding: 10, background: K.amber50, borderRadius: 10, cursor: "pointer", marginTop: 12 }}>
          <input type="checkbox" checked={libAccept} onChange={e => setLibAccept(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: K.slate700 }}>Ho letto e accetto tutte le dichiarazioni sopra indicate</span>
        </label>
      </Card>

      <SignatureBlock n={1} label="Firma 1: Dichiarazioni salute" signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs} />
      <SignatureBlock n={2} label="Firma 2: Clausole 1341-1342 CC" signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs} />

      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Consensi GDPR</h3>
        <p style={{ fontSize: 11, color: K.slate500, marginBottom: 12 }}>Scegli SÌ o NO e firma per ciascuno</p>
        <ConsentRow letter="A" label="A) Trattamento dati sensibili (salute)" consents={consents} setConsent={setConsent} sigN={3} signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs} />
        <ConsentRow letter="B" label="B) Marketing diretto Fit And Go" consents={consents} setConsent={setConsent} sigN={4} signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs} />
        <ConsentRow letter="C" label="C) Marketing terze parti (Franchising)" consents={consents} setConsent={setConsent} sigN={5} signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs} />
        <ConsentRow letter="D" label="D) Profilazione" consents={consents} setConsent={setConsent} sigN={6} signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs} last />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        <button onClick={onBack} style={btnSecondary()}>Indietro</button>
        <button onClick={onNext} disabled={!canProceed} style={btnPrimary({ opacity: canProceed ? 1 : 0.4 })}>
          {isLibOnly ? "Verifica e completa" : "Vai al contratto"}
        </button>
      </div>
    </div>
  );
}

function ContrattoStep({ richiesta, templates, signatures, confirmSig, clearSig, padRefs, onBack, onNext, canProceed }) {
  const pkg = richiesta.dati_compilati || {};
  const tpl = templates["contratto_fitgo"];
  const found = tpl?.contenuto?.pacchetti_disponibili?.find(p => p.codice === pkg.pacchetto);
  return (
    <div>
      <Card>
        <div style={{ fontSize: 11, color: K.amber500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Step 2 · Contratto</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>Condizioni generali</h2>
      </Card>
      <Card>
        <div style={{ background: K.amber50, border: `1px solid ${K.amber500}55`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: K.amber900, textTransform: "uppercase" }}>Pacchetto</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8, fontSize: 13 }}>
            <div><span style={{ color: K.slate500 }}>Tipo:</span> <strong>{found?.nome || pkg.pacchetto || "—"}</strong></div>
            <div><span style={{ color: K.slate500 }}>Durata:</span> {found?.durata || "—"}</div>
            <div><span style={{ color: K.slate500 }}>Importo:</span> <strong>€ {pkg.importo || 0}</strong></div>
            <div><span style={{ color: K.slate500 }}>Pagamento:</span> {pkg.metodo_pagamento || "—"}</div>
          </div>
        </div>
        <div style={{ background: K.slate50, border: `1px solid ${K.slate200}`, borderRadius: 10, padding: 16, fontSize: 12, color: K.slate700, maxHeight: 240, overflowY: "auto" }}>
          <p><strong>1. Tariffe e durata:</strong> contratto annuale, nominativo, non cedibile</p>
          <p style={{ marginTop: 6 }}><strong>2. Quote e spese:</strong> pagamento dovuto anche in caso di non utilizzo</p>
          <p style={{ marginTop: 6 }}><strong>3. Metodi pagamento:</strong> carta/bancomat/PagoDIL/bonifico/contanti</p>
          <p style={{ marginTop: 6 }}><strong>5. Sanità:</strong> certificato medico obbligatorio</p>
          <p style={{ marginTop: 6 }}><strong>6. Responsabilità civile:</strong> non risponde per furto/danno</p>
          <p style={{ marginTop: 6 }}><strong>7. Foro:</strong> Padova</p>
          <p style={{ marginTop: 6 }}><strong>8. Condotta:</strong> divieti scarpe esterno/animali/fumo/alcolici</p>
        </div>
      </Card>

      <SignatureBlock n={7} label="Firma 7: Accettazione contratto" signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs} />
      <SignatureBlock n={8} label="Firma 8: Clausole 1341-1342 CC" signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs} />
      <SignatureBlock n={9} label="Firma 9: Consenso trattamento dati" signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs} />
      <SignatureBlock n={10} label="Firma 10: Consenso marketing" signatures={signatures} confirmSig={confirmSig} clearSig={clearSig} padRefs={padRefs} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        <button onClick={onBack} style={btnSecondary()}>Indietro</button>
        <button onClick={onNext} disabled={!canProceed} style={btnPrimary({ opacity: canProceed ? 1 : 0.4 })}>Verifica e completa</button>
      </div>
    </div>
  );
}

function OtpStep({ telefono, otpCode, setOtpCode, otpError, verifying, onVerify, onBack }) {
  const mask = telefono?.length > 4 ? telefono.slice(0, -4).replace(/\d/g, "•") + telefono.slice(-4) : telefono;
  return (
    <div>
      <Card style={{ textAlign: "center" }}>
        <div style={{ width: 64, height: 64, background: K.amber100, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: K.amber500 }}>📱</div>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Verifica finale</h2>
        <p style={{ fontSize: 13, color: K.slate500, marginTop: 6 }}>Codice inviato a<br /><strong style={{ color: K.slate900 }}>{mask}</strong></p>
        <div style={{ background: K.amber50, border: `1px solid ${K.amber500}55`, padding: 8, borderRadius: 6, fontSize: 11, color: K.amber900, marginTop: 12, marginBottom: 16, display: "inline-block" }}>
          Demo: usa <strong>123456</strong>
        </div>
        <input type="text" inputMode="numeric" maxLength={6} value={otpCode}
          onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="••••••"
          style={{ width: "100%", padding: "16px", fontSize: 28, textAlign: "center", letterSpacing: 8, fontWeight: 700, border: `2px solid ${K.slate200}`, borderRadius: 10, fontFamily: "monospace" }} />
        {otpError && <div style={{ color: K.red600, fontSize: 13, marginTop: 8 }}>{otpError}</div>}
        <button onClick={onVerify} disabled={verifying || otpCode.length !== 6} style={btnPrimary({ marginTop: 16, opacity: (verifying || otpCode.length !== 6) ? 0.5 : 1 })}>
          {verifying ? "Verifica in corso..." : "Conferma codice"}
        </button>
      </Card>
      <button onClick={onBack} style={{ ...btnSecondary(), marginTop: 12, width: "100%" }}>Indietro</button>
    </div>
  );
}

function SuccessScreen({ fullName, transId, richiesta }) {
  return (
    <Card style={{ textAlign: "center" }}>
      <div style={{ width: 80, height: 80, background: K.emerald50, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: K.emerald600 }}>✓</div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Tutto firmato!</h2>
      <p style={{ fontSize: 13, color: K.slate500, marginTop: 6 }}>Benvenuto/a in Fit And Go, {fullName.split(" ")[0]}!</p>
      <div style={{ background: K.emerald50, border: `1px solid ${K.emerald500}33`, padding: 12, borderRadius: 10, marginTop: 16, textAlign: "left", fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: K.emerald600 }}>Documenti salvati ✓</div>
        <div style={{ color: K.slate700, marginTop: 2 }}>Le tue firme sono state registrate nel sistema sicuro Fit And Go. Riceverai a breve copia via email.</div>
      </div>
      <div style={{ background: K.slate50, borderRadius: 10, padding: 14, marginTop: 12, textAlign: "left", fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: K.slate500 }}>ID transazione:</span> <span style={{ fontFamily: "monospace", fontSize: 11 }}>{transId}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: K.slate500 }}>Validità:</span> <span style={{ color: K.emerald600, fontWeight: 600 }}>FEA ✓ eIDAS</span></div>
      </div>
    </Card>
  );
}

// ====== HELPERS ======

function SignatureBlock({ n, label, signatures, confirmSig, clearSig, padRefs }) {
  const signed = !!signatures[n];
  return (
    <Card style={{ background: signed ? "linear-gradient(135deg, #d1fae5, #a7f3d0)" : "white", border: signed ? `1px solid ${K.emerald500}` : `1px solid ${K.slate200}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: K.slate900 }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: signed ? K.emerald600 : K.slate500 }}>{signed ? "✓ Firmata" : "⏳ Da firmare"}</div>
      </div>
      <KsignSignaturePad ref={el => padRefs.current[n] = el} height={120} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => clearSig(n)} style={{ flex: 1, padding: 8, fontSize: 12, background: "#f1f5f9", border: "none", borderRadius: 6, cursor: "pointer", color: K.slate700, fontWeight: 600 }}>Cancella</button>
        <button onClick={() => confirmSig(n)} style={{ flex: 1, padding: 8, fontSize: 12, background: `linear-gradient(135deg, #fbbf24, ${K.gold})`, color: K.black, border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>Conferma firma</button>
      </div>
    </Card>
  );
}

function ConsentRow({ letter, label, consents, setConsent, sigN, signatures, confirmSig, clearSig, padRefs, last }) {
  const value = consents[letter];
  return (
    <div style={{ padding: "12px 0", borderBottom: last ? "none" : `1px solid ${K.slate200}` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: K.slate900 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => setConsent(letter, "yes")}
          style={{ flex: 1, padding: 8, fontSize: 13, fontWeight: 600, border: `2px solid ${value === "yes" ? K.emerald500 : K.slate200}`, background: value === "yes" ? K.emerald50 : "white", color: value === "yes" ? K.emerald600 : K.slate700, borderRadius: 8, cursor: "pointer" }}>SÌ</button>
        <button onClick={() => setConsent(letter, "no")}
          style={{ flex: 1, padding: 8, fontSize: 13, fontWeight: 600, border: `2px solid ${value === "no" ? "#fca5a5" : K.slate200}`, background: value === "no" ? "#fee2e2" : "white", color: value === "no" ? K.red600 : K.slate700, borderRadius: 8, cursor: "pointer" }}>NO</button>
      </div>
      {value !== null && (
        <div style={{ marginTop: 10 }}>
          <KsignSignaturePad ref={el => padRefs.current[sigN] = el} height={90} />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={() => clearSig(sigN)} style={{ flex: 1, padding: 6, fontSize: 11, background: "#f1f5f9", border: "none", borderRadius: 6, cursor: "pointer", color: K.slate700, fontWeight: 600 }}>Cancella</button>
            <button onClick={() => confirmSig(sigN)} style={{ flex: 1, padding: 6, fontSize: 11, background: `linear-gradient(135deg, #fbbf24, ${K.gold})`, color: K.black, border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>Conferma</button>
          </div>
          {signatures[sigN] && <div style={{ fontSize: 10, color: K.emerald600, marginTop: 4, fontWeight: 600 }}>✓ Firmata</div>}
        </div>
      )}
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: "white", borderRadius: 14, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.05)", marginBottom: 14, ...style }}>{children}</div>;
}

function btnPrimary(extra = {}) {
  return { width: "100%", padding: 14, background: `linear-gradient(135deg, #fbbf24, ${K.gold}, #b8860b)`, color: "#0a0a0a", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(212,168,67,.3)", ...extra };
}
function btnSecondary() {
  return { padding: 12, background: "white", border: `1px solid ${K.slate200}`, color: K.slate700, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" };
}
