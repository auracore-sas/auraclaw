-- V901 (Auracore): channel ownership — see kingbase/V901 for semantics.
-- MySQL lacks `ADD COLUMN IF NOT EXISTS`; use INFORMATION_SCHEMA guard instead.
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mate_channel' AND COLUMN_NAME = 'owner_username');
SET @s := IF(@c = 0, 'ALTER TABLE mate_channel ADD COLUMN owner_username VARCHAR(64) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
