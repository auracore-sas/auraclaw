-- V901 (Auracore): channel ownership — see kingbase/V901 for semantics.
-- AuraClaw: individual channels. NULL owner_username → shared/legacy
-- (upstream behaviour, conversations owned by 'system').
ALTER TABLE mate_channel ADD COLUMN IF NOT EXISTS owner_username VARCHAR(64) DEFAULT NULL;
