-- V900 (Auracore): model usage scope — see kingbase/V900 for semantics.
ALTER TABLE mate_model_config ADD COLUMN IF NOT EXISTS usage_scope VARCHAR(512) DEFAULT NULL;
