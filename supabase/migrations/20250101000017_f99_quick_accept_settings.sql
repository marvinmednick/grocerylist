ALTER TABLE profiles ADD COLUMN IF NOT EXISTS quick_accept_settings JSONB DEFAULT '{"trigger_word": "enter", "arming_delay_ms": 1500}';
