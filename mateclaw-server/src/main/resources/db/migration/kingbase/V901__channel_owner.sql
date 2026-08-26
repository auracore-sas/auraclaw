-- V901 (Auracore): channel ownership — individual channels.
--
-- owner_username: AuraClaw platform username that owns the channel.
--   NULL  → shared/legacy channel: conversations stay 'system'-owned and
--           visible to every workspace member (upstream behaviour).
--   value → individual channel: conversations are created with this
--           username as owner and are only visible to that user
--           (global admins still cross-cut via isConversationOwner).
-- KingbaseES / PostgreSQL share this tree.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'mate_channel' AND column_name = 'owner_username'
    ) THEN
        ALTER TABLE mate_channel ADD COLUMN owner_username VARCHAR(64) DEFAULT NULL;
    END IF;
END $$;
