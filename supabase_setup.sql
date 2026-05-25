-- =====================================================================
-- KENDO APP - SETUP SUPABASE (CRM clienti + lead + sicurezza)
-- =====================================================================
-- Incolla questo file nel SQL Editor di Supabase e premi Run.
-- E' idempotente: puoi rieseguirlo senza problemi.
--
-- Strategia:
--   profiles  = utenti registrati che usano l'app (legati ad auth.users)
--   clienti   = anagrafica completa del CRM (NON legati ad auth.users)
--   leads     = nuovi contatti da convertire in clienti
--
--   Un cliente del CRM puo' avere un account app: in quel caso
--   clienti.user_id punta a profiles.id (= auth.users.id).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABELLA CLIENTI (CRM puro - import da CSV Fit & Go)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clienti (
  id              bigserial PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- NULL se il cliente non si e' ancora registrato all'app

  -- anagrafica
  nome            text NOT NULL,
  cognome         text,
  email           text,
  telefono        text,
  data_nascita    date,
  sesso           text,        -- MASCHILE | FEMMINILE | NON_SPECIFICATO
  cap             text,

  -- CRM / status
  status_crm      text NOT NULL DEFAULT 'CLIENTE ATTIVO',
  -- CLIENTE ATTIVO | CLIENTE INATTIVO | CLIENTE STAND BY | EX | MISS | ESCLUSO | LEAD CAMPAGNE | PERSO | TOUR SPONTANEO | LEAD REFERRAL
  origine         text,        -- "Passaparola" / "Social network" / "LEAD sito" / ...
  negozio         text DEFAULT 'FIT Padova',

  -- pacchetto / sedute (da gestire a mano dall'admin nell'app)
  pacchetto       text,        -- EMS | Vacufit | Combinato EMS+Vacufit
  sedute_total    int  DEFAULT 0,
  sedute_usate    int  DEFAULT 0,
  data_inizio_pacchetto    date,
  data_scadenza_pacchetto  date,
  scadenza_iscrizione      date,
  scadenza_certificato_medico date,

  -- BIA e follow-up
  ultima_bia_data    date,
  prossima_bia_data  date,
  ultimo_appt_data   date,
  prossimo_followup  date,
  note               text,

  -- pagamenti
  valore_cliente      numeric(10,2) DEFAULT 0,    -- totale speso storico
  posizione_debitoria numeric(10,2) DEFAULT 0,    -- debito residuo
  metodo_pagamento    text,
  prossimo_rinnovo    date
);

CREATE INDEX IF NOT EXISTS idx_clienti_status   ON clienti(status_crm);
CREATE INDEX IF NOT EXISTS idx_clienti_telefono ON clienti(telefono);
CREATE INDEX IF NOT EXISTS idx_clienti_email    ON clienti(email);
CREATE INDEX IF NOT EXISTS idx_clienti_user     ON clienti(user_id);

-- trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS clienti_touch_updated ON clienti;
CREATE TRIGGER clienti_touch_updated
  BEFORE UPDATE ON clienti
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------------------------------------------------------------------
-- 2. TABELLA LEADS (nuovi contatti da convertire)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id            bigserial PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  nome          text NOT NULL,
  cognome       text,
  telefono      text,
  email         text,
  fonte         text,                       -- "Sito Fit&Go" / "Instagram" / ...
  messaggio     text,                       -- testo lead se presente
  stato         text NOT NULL DEFAULT 'nuovo',
  -- stato: nuovo | contattato | convertito | scartato
  contattato_at    timestamptz,
  convertito_at    timestamptz,
  cliente_id       bigint REFERENCES clienti(id) ON DELETE SET NULL,
  note             text,
  email_subject    text,
  email_received_at timestamptz,
  source_message_id text UNIQUE             -- Gmail messageId per evitare doppioni
);

CREATE INDEX IF NOT EXISTS idx_leads_stato   ON leads(stato);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);


-- ---------------------------------------------------------------------
-- 3. ESTENSIONE PROFILES (campi extra per utenti registrati)
-- ---------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cliente_id bigint REFERENCES clienti(id) ON DELETE SET NULL;
-- collega l'account app al cliente del CRM


-- ---------------------------------------------------------------------
-- 4. FUNZIONE HELPER: is_admin() (SECURITY DEFINER, evita ricorsione)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;


-- ---------------------------------------------------------------------
-- 5. RLS - PROFILES (clienti vedono se stessi, admin vede tutto)
-- ---------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_self_select ON profiles;
DROP POLICY IF EXISTS profiles_self_update ON profiles;
DROP POLICY IF EXISTS profiles_self_insert ON profiles;
DROP POLICY IF EXISTS profiles_admin_all   ON profiles;

CREATE POLICY profiles_self_select ON profiles
  FOR SELECT TO authenticated
  USING ( id = auth.uid() );

CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE TO authenticated
  USING ( id = auth.uid() )
  WITH CHECK ( id = auth.uid() );

CREATE POLICY profiles_self_insert ON profiles
  FOR INSERT TO authenticated
  WITH CHECK ( id = auth.uid() );

CREATE POLICY profiles_admin_all ON profiles
  FOR ALL TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );


-- ---------------------------------------------------------------------
-- 6. RLS - CLIENTI (solo admin)
-- ---------------------------------------------------------------------
ALTER TABLE clienti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clienti_admin_all ON clienti;
DROP POLICY IF EXISTS clienti_self_read ON clienti;

CREATE POLICY clienti_admin_all ON clienti
  FOR ALL TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- Un cliente registrato puo' vedere SOLO la propria scheda CRM (read-only)
CREATE POLICY clienti_self_read ON clienti
  FOR SELECT TO authenticated
  USING ( user_id = auth.uid() );


-- ---------------------------------------------------------------------
-- 7. RLS - LEADS (solo admin)
-- ---------------------------------------------------------------------
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_admin_all ON leads;

CREATE POLICY leads_admin_all ON leads
  FOR ALL TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );


-- ---------------------------------------------------------------------
-- 8. RLS - BIA
-- ---------------------------------------------------------------------
ALTER TABLE bia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bia_self_select ON bia;
DROP POLICY IF EXISTS bia_admin_all   ON bia;

CREATE POLICY bia_self_select ON bia
  FOR SELECT TO authenticated
  USING ( user_id = auth.uid() );

CREATE POLICY bia_admin_all ON bia
  FOR ALL TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );


-- ---------------------------------------------------------------------
-- 9. RLS - PRENOTAZIONI
-- ---------------------------------------------------------------------
ALTER TABLE prenotazioni ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pren_self_all  ON prenotazioni;
DROP POLICY IF EXISTS pren_admin_all ON prenotazioni;

CREATE POLICY pren_self_all ON prenotazioni
  FOR ALL TO authenticated
  USING ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

CREATE POLICY pren_admin_all ON prenotazioni
  FOR ALL TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );


-- ---------------------------------------------------------------------
-- 10. RLS - FOLLOWUP (solo admin)
-- ---------------------------------------------------------------------
ALTER TABLE followup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS followup_admin_all ON followup;

CREATE POLICY followup_admin_all ON followup
  FOR ALL TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );


-- =====================================================================
-- FINE SETUP. Dopo l'esecuzione carica anche:
--   - kendo_import_clienti.sql  (153 clienti attivi)
--   - kendo_import_lead.sql     (161 lead campagne)
-- =====================================================================
