-- =====================================================================
-- KENDO - BACKUP PRE-SETUP del 2026-05-24
-- =====================================================================
-- Snapshot dello stato del database PRIMA dell'esecuzione di:
--   - supabase_setup.sql (creazione tabella clienti + RLS)
--   - kendo_import_clienti.sql (153 clienti attivi)
--   - kendo_import_lead.sql   (161 lead)
--
-- Se vuoi tornare indietro:
--   1. TRUNCATE tutte le tabelle modificate
--   2. Esegui questo file per rimettere i 2 profili originali
--   3. DROP TABLE IF EXISTS clienti
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- DATI ORIGINALI: profiles (2 record)
-- ---------------------------------------------------------------------

INSERT INTO profiles (id, nome, cognome, email, telefono, pacchetto, sedute_total,
                      sedute_usate, piano, cancellazioni, is_admin, tipo_account)
VALUES
  ('e8fc75c6-a4c7-4c2c-bbc6-b2538b1ba76b',
   'Christian', 'Petrone', 'kendosrls@gmail.com', NULL,
   'EMS', 0, 0, 'gold', 0, true, 'admin'),
  ('2e52e753-d5ba-4aa2-af1b-164e59bb5866',
   'Marco', 'Rossi', 'christian1petrone@gmail.com', '3331234567',
   'EMS', 10, 7, 'platinum', 1, false, 'cliente')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------
-- DATI ORIGINALI: bia          → 0 record
-- DATI ORIGINALI: prenotazioni → 0 record
-- DATI ORIGINALI: followup     → 0 record
-- DATI ORIGINALI: leads        → 0 record
-- ---------------------------------------------------------------------
-- (tabelle vuote, nulla da ripristinare)


-- ---------------------------------------------------------------------
-- SCHEMA ORIGINALE (riassunto colonne)
-- ---------------------------------------------------------------------
-- profiles:    id uuid PK, nome, cognome, data_nascita, luogo_nascita,
--              indirizzo, telefono, email, note, pacchetto,
--              sedute_total(10), sedute_usate(0), piano('basic'),
--              cancellazioni(0), is_admin(false),
--              ragione_sociale, partita_iva, pec, sede_legale,
--              tipo_account('cliente')
--
-- bia:         id uuid PK, user_id uuid, peso, altezza, eta,
--              grasso_perc, massa_muscolare, bmi, obiettivo, deficit,
--              created_at(now())
--
-- prenotazioni: id uuid PK, user_id uuid, data date, ora text,
--               tipo text, stato('confermata'), created_at(now())
--
-- followup:    id uuid PK, cliente_id uuid, data_contatto, motivo,
--              esito, prossima_azione, created_at(now())
--
-- leads:       nome NOT NULL, cognome NOT NULL, email, cellulare,
--              telefono_normalizzato, campagna, fonte('Shoma'),
--              stato('nuovo'), whatsapp_inviato(false),
--              whatsapp_inviato_at, note, email_id
-- =====================================================================
