# 📋 CONTEXT — Progetto Kendo

> **File di contesto per Claude/Cowork**  
> Aggiornato al: 24 maggio 2026  
> Workspace: `C:\Users\Utente\kendo-app`

---

## 👤 Chi sono

**Christian Petrone**, fondatore di **Kendo SRLS**.  
Gestisco la palestra **Fit and Go Padova**, centro EMS + Vacufit.  
Sto sviluppando un'app web interna per gestire clienti, lead, prenotazioni, BIA e follow-up.

---

## 🛠️ Stack tecnico

- **Frontend**: React (Create React App)
- **Backend/DB**: Supabase
- **Hosting**: Vercel (piano Hobby gratuito)
- **Versioning**: GitHub Desktop / git CLI
- **AI**: Anthropic API (Claude) — già configurata
- **Email**: Gmail API + OAuth (per leggere lead automaticamente)
- **Workspace locale**: `C:\Users\Utente\kendo-app`

---

## 🔗 URL e accessi

- **Produzione Vercel**: `https://kendo-j8opmupt3-kendosrls-6341s-projects.vercel.app`
- **Repository GitHub** collegato a Vercel (deploy automatico su push su `main`)
- **Account Anthropic Console**: organizzazione Kendo SRLS, 20 USD di crediti caricati
- **Account Vercel**: progetto `kendo-app` sotto org `kendosrls-6341` (piano Hobby)
- **Account Supabase**: progetto `kendo`
- **Gmail**: casella `fitandgopadova@gmail.com` con OAuth configurato

---

## 🔑 Variabili d'ambiente su Vercel

### ✅ Già configurate
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `ANTHROPIC_API_KEY`
- `REACT_APP_SUPABASE_ANON_KEY`

### ⚠️ Da verificare/aggiungere
- `REACT_APP_SUPABASE_URL` — l'URL del progetto Supabase. Lo trovi su supabase.com → progetto `kendo` → Settings → API → Project URL

---

## 🗄️ Database Supabase

### Tabelle esistenti
- `profiles`
- `bia`
- `followup`
- `prenotazioni`
- `leads` (creata di recente)

### Struttura tabella `leads`

| Colonna | Tipo | Default |
|---|---|---|
| `id` | int8 | auto |
| `created_at` | timestamptz | `now()` |
| `nome` | text | — |
| `cognome` | text | — |
| `email` | text | — |
| `cellulare` | text | — |
| `telefono_normalizzato` | text | — |
| `campagna` | text | — |
| `fonte` | text | `'Shoma'` |
| `stato` | text | `'nuovo'` |
| `whatsapp_inviato` | bool | `false` |
| `whatsapp_inviato_at` | timestamptz | — |
| `note` | text | — |
| `email_id` | text | — |

### RLS Policies attive su `leads`
- `Allow read leads` → `SELECT` pubblico
- `Allow write leads` → `ALL` per utenti `authenticated`

---

## 🎯 OBIETTIVO IMMEDIATO: Automazione lead Gmail → Dashboard

### Flusso desiderato

1. Email arriva su `fitandgopadova@gmail.com` da `Comunicazioni@fitandgo.it` con oggetto `NUOVO LEAD PER TE`
2. Una Vercel Cron Function legge Gmail ogni 5 minuti
3. Estrae i dati dall'email: nome, cognome, email, cellulare, campagna marketing
4. Salva il lead nella tabella `leads` su Supabase (con check anti-duplicati)
5. Marca l'email come letta su Gmail
6. Il lead appare nella nuova pagina "Lead" della dashboard Kendo
7. Click su "WhatsApp" → apre `wa.me/...` con messaggio personalizzato già scritto

### Esempio email reale da parsare

**Mittente**: `Comunicazioni@fitandgo.it`  
**Oggetto**: `NUOVO LEAD PER TE`  
**Body**:
```
hai un nuovo cliente che ha richiesto una prova tramite la campagna AFF | PADOVA | LAL 6% | LEAD ADS | 5.25
ricontattalo al più presto, è un potenziale cliente!

Ecco tutte le informazioni del contatto:

Nome: Monica
Cognome: Ferrara
Cellulare: 393333589248
Email: ferraramonica64@gmail.com
```

> ⚠️ Esiste anche una seconda fonte email da `no-reply.obezm0@zapiermail.com` con oggetto `Nuovo Lead Padova` (campo telefono chiamato `Telefono:`). **NON leggerla** per evitare doppi messaggi WhatsApp — leggi solo da `Comunicazioni@fitandgo.it`.

### Messaggio WhatsApp predefinito

Placeholder `{nome}` verrà sostituito col nome del lead:

```
Buongiorno {nome}! 😊
Sono Christian di Fit And Go Padova ⚡. Ti scrivo perché ho ricevuto la tua richiesta per la prova gratuita! 🎁 
Per organizzarla al meglio, posso chiederti quale obiettivo ti piacerebbe raggiungere? 🎯 (Ad esempio: rimetterti in forma in poco tempo ⏱️, tonificare 💪, o combattere la ritenzione idrica 💧?) 
Così capiamo insieme se è più adatto a te l'allenamento EMS, il Vacufit o entrambi! 🏃‍♀️🔥
```

---

## 🛠️ COSA FARE (in ordine)

### Step 1 — Esplora il progetto
Leggi la struttura di `C:\Users\Utente\kendo-app`, in particolare:
- `package.json` (dipendenze e script)
- `src/App.js` (struttura dashboard, come aggiungere card "Lead")
- `src/` (stile dei componenti esistenti)

### Step 2 — Installa pacchetto Supabase
```bash
npm install @supabase/supabase-js
```

### Step 3 — Crea `vercel.json` nella root
```json
{
  "crons": [
    {
      "path": "/api/cron-gmail-leads",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Step 4 — Crea `api/cron-gmail-leads.js`

> Cartella `api/` da creare se non esiste.

Vercel Function che deve:

1. **Ottenere access token Gmail** dal refresh token via OAuth:
   - `POST https://oauth2.googleapis.com/token`
   - Body: `client_id`, `client_secret`, `refresh_token`, `grant_type=refresh_token`

2. **Cercare email** con query Gmail API:
   ```
   from:Comunicazioni@fitandgo.it subject:"NUOVO LEAD PER TE" is:unread
   ```
   Endpoint: `GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q=...&maxResults=50`

3. **Per ogni email trovata**:
   - Legge il body (gestendo sia `text/plain` che `text/html`, decoding base64url)
   - Pulisce eventuale HTML
   - Estrae con regex: Nome, Cognome, Email, Cellulare (può chiamarsi anche `Telefono`), Campagna
   - Normalizza il telefono: rimuove spazi, `+`, `39` iniziale, `0` iniziale
   - **Check duplicato 1**: cerca su Supabase se esiste già un lead con quel `email_id`
   - **Check duplicato 2**: cerca se esiste un lead con quel `telefono_normalizzato` negli ultimi 7 giorni
   - Se non duplicato → `INSERT` nella tabella `leads`
   - Marca email come letta su Gmail (POST modify con `removeLabelIds: ['UNREAD']`)

4. **Ritorna JSON**:
   ```json
   {
     "success": true,
     "stats": {
       "emailTrovate": 0,
       "leadSalvati": 0,
       "leadDuplicati": 0,
       "errori": []
     }
   }
   ```

**Variabili env da usare**:
- `process.env.GMAIL_CLIENT_ID`
- `process.env.GMAIL_CLIENT_SECRET`
- `process.env.GMAIL_REFRESH_TOKEN`
- `process.env.REACT_APP_SUPABASE_URL`
- `process.env.REACT_APP_SUPABASE_ANON_KEY`

### Step 5 — Crea `src/components/Leads.js`

Componente React per la pagina Lead. Deve avere:

**Header**:
- Titolo "📋 Lead"
- Bottone "← Indietro" (prop `onBack`)
- Bottone refresh "🔄"

**Filtri stato** con badge count:
- Tutti / 🆕 Nuovo / 📞 Contattato / 💪 Prova fissata / ✅ Cliente / ❌ Perso

**Barra di ricerca** per nome / email / telefono

**Lista card lead** ordinata per `created_at desc`, ogni card mostra:
- Nome + Cognome (grande)
- Data/ora (piccolo, grigio)
- Badge stato colorato
- 📱 Cellulare
- 📧 Email
- 🎯 Campagna
- Se `whatsapp_inviato`: "✅ WhatsApp inviato il {data}"
- **Bottone verde "💬 WhatsApp"**: apre `wa.me/{numero con prefisso 39}?text={messaggio sostituito}` in nuova tab
- **Dropdown stato**: cambia stato del lead (`UPDATE` su Supabase)
- **Bottone elimina** 🗑 con conferma

**Comportamento WhatsApp**:
- Dopo click su WhatsApp, dopo 2 secondi marca `whatsapp_inviato=true`, `whatsapp_inviato_at=now()`, `stato='contattato'`

**Stile**:
- Tema dark: background `#0f172a`, card `#1f2937`, testi bianchi
- Mobile-first responsive

### Step 6 — Modifica `src/App.js`

- Aggiungi `import Leads from './components/Leads'` in cima
- Aggiungi card "📋 Lead" cliccabile nella dashboard (**stesso stile delle altre card esistenti**: Agenda, Follow-up, BIA, ecc.)
- Gestisci routing: click su card Lead → mostra `<Leads onBack={...} />`, indietro → torna alla dashboard

> ⚠️ **IMPORTANTE**: prima di modificare `App.js`, **mostra il diff** delle modifiche proposte. NON sovrascrivere senza farmi controllare.

### Step 7 — Verifica build
```bash
npm run build
```
Se compila senza errori → procedi. Se errori → mostrali e risolviamo.

### Step 8 — Commit + push (da terminale)
```bash
git add .
git commit -m "feat: automazione lead Gmail + pagina Lead dashboard"
git push origin main
```

Vercel farà il deploy automatico.

### Step 9 — Test in produzione
- Apri l'URL di produzione Vercel
- Verifica che la card Lead appaia in dashboard
- Clicca → verifica che si apra la pagina (vuota se non ci sono lead)
- Forza esecuzione cron chiamando manualmente: `{URL_PRODUZIONE}/api/cron-gmail-leads`
- Verifica response JSON con stats

---

## ⚠️ Punti di attenzione

### 1. Limite Vercel Hobby
I Cron Jobs su piano Hobby sono limitati a **1 al giorno in produzione**. Se Vercel restituisce errore sul cron `*/5 * * * *`, suggerire come fallback:
- **Opzione A**: cambiare schedule a `0 * * * *` (1/ora) o `0 9-22 * * *` (ogni ora 9-22)
- **Opzione B**: usare **cron-job.org** (gratuito) per chiamare l'endpoint ogni 5 minuti dall'esterno
- **Opzione C**: upgrade a Vercel Pro ($20/mese) per cron illimitati

### 2. Nomi colonne tabella `leads`
Usa **ESATTAMENTE** i nomi elencati nella sezione database, sono già stati creati.

### 3. RLS Supabase
La policy "Allow write leads" è per role `authenticated`. La Vercel Function userà la `ANON_KEY` → **potrebbe servire una policy aggiuntiva per role `anon`** oppure usare la `SUPABASE_SERVICE_ROLE_KEY`.

Verifica e se serve aggiungere la `SERVICE_ROLE_KEY`, dimmelo che la prendiamo su Supabase → Settings → API → service_role key (⚠️ molto sensibile, va solo lato server).

### 4. Mobile-first
L'app è usata principalmente da telefono in palestra. Tutto deve essere responsive e leggibile da smartphone.

### 5. Sicurezza chiave Anthropic
La chiave `***ANTHROPIC_KEY_REVOKED_2026-05-25***` è stata condivisa in chat — più avanti andrebbe **revocata e rigenerata** su console.anthropic.com.

---

## 📝 TODO list rimanente (dopo automazione lead)

1. **Bug**: card dashboard non cliccabili da PC (funzionano da mobile, da desktop no)
2. **Reset password** utente test: `christian1petrone@gmail.com` (password dimenticata)
3. **Migliorare sezione Agenda** (più completa e funzionale)
4. **Potenziare sezione Follow-up** (notifiche, scadenze, automatismi)
5. **Upload PDF/foto BIA** con estrazione dati via Claude AI (API già configurata)
6. **Restyling generale** app più professionale (look elegante, brandizzato Fit and Go)
7. **WhatsApp Business API automatico** (Meta Cloud API)
   - Pendente decisione su numero dedicato
   - Opzioni: Twilio (~1€/mese, ~80% successo verifica) / SIM Iliad (~7€/mese, 100% successo)
   - Numero attuale di Fit and Go NON utilizzabile (è il numero principale di lavoro)

---

## 📌 Convenzioni di lavoro

- **Procedi uno step alla volta**, mostrando cosa fai mano a mano
- **Per modifiche a file esistenti** (es. `App.js`, `package.json`), mostra sempre il diff prima di applicare
- **Non sovrascrivere** file senza conferma
- **Mobile-first** sempre nel design
- **Commit messaggi** in formato conventional: `feat:`, `fix:`, `chore:`, `style:`, ecc.
- **Aggiorna questo file CONTEXT.md** mano a mano che completi step (sposta da TODO a "Fatto")

---

## ✅ Fatto finora

- [x] Setup progetto Vercel + GitHub Desktop
- [x] Setup Supabase con tabelle base
- [x] Google Cloud Project + Gmail API abilitata
- [x] OAuth credentials creati
- [x] Refresh Token ottenuto via OAuth Playground
- [x] Variabili env Gmail su Vercel
- [x] Account Anthropic Console + 20 USD crediti + API key configurata su Vercel
- [x] Tabella `leads` su Supabase con RLS policies

## 🔄 In corso

- [ ] Automazione lead Gmail → Supabase → Dashboard (Step 1-9 sopra)

---

**Inizia dallo Step 1 (esplora il progetto). Dopo ogni step fammi vedere cosa hai fatto prima di passare al successivo.**

Buon lavoro! 💪
