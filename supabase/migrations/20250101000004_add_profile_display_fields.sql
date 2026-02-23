-- supabase/migrations/20250101000004_add_profile_display_fields.sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name_short TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#2563eb';
