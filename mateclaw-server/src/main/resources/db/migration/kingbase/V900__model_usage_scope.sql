-- V900 (Auracore): model usage scope — allow a chat model to serve specific
-- internal jobs (e.g. wiki digestion) while being excluded from normal chat.
--
-- usage_scope is a JSON array of lowercase use names, e.g.
-- '["chat","wiki"]', '["wiki"]', NULL / empty → legacy behaviour: chat-usable.
-- 'chat' absent from the array ⇒ the model is dedicated to internal jobs and
-- must never be selected/resolved/failed-over as a normal chat model.
-- KingbaseES / PostgreSQL share this tree.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'mate_model_config' AND column_name = 'usage_scope'
    ) THEN
        ALTER TABLE mate_model_config ADD COLUMN usage_scope VARCHAR(512) DEFAULT NULL;
    END IF;
END $$;
