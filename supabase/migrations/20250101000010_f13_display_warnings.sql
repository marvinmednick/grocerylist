-- F13: List Display Density & Warnings

-- 1. Add short_name to items (nullable, user-defined display name)
ALTER TABLE items ADD COLUMN IF NOT EXISTS short_name TEXT;

-- 2. Add warnings JSONB to list_items (populated by F12 at add time)
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS warnings JSONB DEFAULT '[]';

-- 3. Add warning_preferences JSONB to profiles (per-user display prefs)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS warning_preferences JSONB DEFAULT '{
  "avoided": "toast_and_badge",
  "unavailable": "toast_and_badge",
  "non_preferred": "badge_only",
  "non_standard_qty": "badge_only"
}';
