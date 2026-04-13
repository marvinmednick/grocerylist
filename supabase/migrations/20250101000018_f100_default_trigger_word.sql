UPDATE profiles
SET quick_accept_settings = jsonb_set(quick_accept_settings, '{trigger_word}', '"done"', false)
WHERE quick_accept_settings->>'trigger_word' = 'enter';

ALTER TABLE profiles
ALTER COLUMN quick_accept_settings
SET DEFAULT '{"trigger_word": "done", "arming_delay_ms": 1500}';
