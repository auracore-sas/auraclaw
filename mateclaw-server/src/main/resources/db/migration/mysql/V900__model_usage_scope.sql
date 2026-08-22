-- V900 (Auracore): model usage scope — see kingbase/V900 for semantics.
-- MySQL lacks `ADD COLUMN IF NOT EXISTS`; use INFORMATION_SCHEMA guard instead.
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mate_model_config' AND COLUMN_NAME = 'usage_scope');
SET @s := IF(@c = 0, 'ALTER TABLE mate_model_config ADD COLUMN usage_scope VARCHAR(512) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
