-- Migration 08: Enable RLS on tables where it was not applied in production.
-- The policies for these tables already exist (created in earlier migrations)
-- but RLS itself was not enabled, rendering the policies inert.
-- Ref: Supabase dashboard errors policy_exists_rls_disabled + rls_disabled_in_public.
--
-- Effect after this migration:
--   shopping_trips  → household-scoped (all members see all household trips)
--   item_stores     → household-scoped (all members see all household item-store links)
--   units           → read-only for all authenticated users (global seed data, no household_id)

ALTER TABLE item_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
