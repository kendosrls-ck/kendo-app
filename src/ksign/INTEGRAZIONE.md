# K-Sign · Integrazione in Kendo App

Componenti già creati in `src/ksign/`:
- `Ksign.js` — tab admin "Firme" (lista + creazione richieste)
- `KsignFirma.js` — pagina firma cliente pubblica (apre da `/firma/[token]`)
- `KsignSignaturePad.js` — componente firma riutilizzabile

## 3 modifiche minime da fare a `App.js`

### 1. Import in cima al file

Aggiungi vicino agli altri import (riga 3-10):

```js
import Ksign from "./ksign/Ksign";
import KsignFirma from "./ksign/KsignFirma";
```

### 2. Routing pagina firma pubblica (PRIMA del check auth)

All'inizio del componente principale dell'app (subito dopo `function App()` o dove ritorna il primo JSX), aggiungi questo check come **prima cosa**, prima di tutto il resto:

```js
// Pagina firma cliente: rotta pubblica, no auth necessaria
if (typeof window !== "undefined" && window.location.pathname.startsWith("/firma/")) {
  return <KsignFirma />;
}
```

In pratica: se l'URL inizia con `/firma/`, mostriamo direttamente la pagina firma senza passare per il login Kendo.

### 3. Aggiungi voce "Firme" al menu admin

Trova la riga 245 (`const adminNav=[...]`) e aggiungi:

```js
const adminNav=[
  {id:"home",icon:"◈",label:"Dashboard"},
  {id:"lead",icon:"◆",label:"Lead"},
  {id:"clienti",icon:"○",label:"Clienti"},
  {id:"agenda",icon:"◷",label:"Agenda"},
  {id:"followup",icon:"◉",label:"Follow-up"},
  {id:"firme",icon:"✎",label:"Firme"},   // <-- AGGIUNGI QUESTA RIGA
  {id:"chat",icon:"◎",label:"AI"},
];
```

### 4. Rendering del tab Firme

Dove ci sono le altre righe `{tab==="..." && <Component/>}` (intorno a riga 348-360), aggiungi:

```js
{tab==="firme" && <Ksign navTarget={navTarget}/>}
```

## Configurazione Vercel

Il tuo `vercel.json` attuale gestisce già il fallback SPA verso `index.html`, quindi `/firma/[token]` arriva correttamente al componente. Non servono modifiche.

## Dipendenze

I componenti usano:
- `signature_pad` — caricato dinamicamente da CDN al primo uso (no npm install)
- `@supabase/supabase-js` — già nel tuo `package.json`

Volendo si può aggiungere `signature_pad` come dipendenza npm pulita:

```bash
npm install signature_pad
```

E poi sostituire nel file `KsignSignaturePad.js` lo script-loader con un normale `import SignaturePad from "signature_pad"`. Per ora va benissimo caricato da CDN.

## Variabili d'ambiente

Già configurate nel tuo Vercel:
- `REACT_APP_SUPABASE_URL` ✓
- `REACT_APP_SUPABASE_ANON_KEY` ✓

## Database

Le 7 tabelle `ksign_*` sono già attive sul tuo Supabase:
- `ksign_template` (2 template pre-popolati: liberatoria + contratto Fit And Go)
- `ksign_richiesta` (richieste firma)
- `ksign_firma` (singole firme, immutabili)
- `ksign_consenso` (consensi GDPR A/B/C/D)
- `ksign_audit_log` (audit immutabile per validità eIDAS)
- `ksign_pdf` (riferimenti PDF Storage)
- `ksign_otp` (codici OTP temporanei)

Storage bucket `ksign-pdf` (privato, 10MB max) pronto.

## Test rapido dopo l'integrazione

1. Push su GitHub → Vercel deploya in 30 secondi
2. Vai sulla tua URL Vercel → login normale Kendo App
3. Click sul nuovo tab "Firme" nella sidebar
4. Click "Nuova firma" → seleziona "Pacchetto completo" → cerca un cliente esistente → "Crea richiesta"
5. **Copia il link generato** (format `https://tua-app.vercel.app/firma/abc123...`)
6. Apri il link dal telefono → vedrai la pagina firma con i dati del cliente caricati da Supabase
7. Completa flusso → torna al tab Firme nella dashboard: vedi la richiesta passata a "Firmato" in real-time

## Cosa NON è ancora pronto (Fase 2)

- Invio automatico via WhatsApp/Email/SMS (per ora copi il link a mano)
- OTP via SMS reale (per ora demo `123456`)
- Generazione PDF lato server con hash crittografico vero
- Email automatica al cliente con PDF allegati
- Reminder automatici scaduti

Tutto questo è già **predisposto a livello database** (tabella `ksign_otp` con rate-limit, `ksign_pdf` con storage path, ecc.) — manca solo l'Edge Function per chiamare i servizi esterni (Resend, Twilio).
