-- ============================================================
-- Migration 04: Household Infrastructure
-- Adds households, profiles, household_id to all user-scoped tables
-- ============================================================

-- 1. NEW TABLES
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT DEFAULT 'My Household',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX profiles_household_idx ON profiles(household_id);

-- 2. ADD household_id TO EXISTING TABLES (nullable first for backfill)
ALTER TABLE items ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE CASCADE;
CREATE INDEX items_household_idx ON items(household_id);

ALTER TABLE item_stores ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE CASCADE;

ALTER TABLE list_items ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE CASCADE;
CREATE INDEX list_items_household_idx ON list_items(household_id);

ALTER TABLE shopping_trips ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE CASCADE;
CREATE INDEX shopping_trips_household_idx ON shopping_trips(household_id);

-- 3. Drop global UNIQUE on items.name, replace with per-household unique
ALTER TABLE items DROP CONSTRAINT items_name_key;
ALTER TABLE items ADD CONSTRAINT items_name_household_unique UNIQUE (name, household_id);

-- 4. SEED DEFAULT HOUSEHOLD
INSERT INTO households (name) VALUES ('My Household');

-- 5. BACKFILL existing data with default household
DO $$
DECLARE
    default_hh_id UUID;
BEGIN
    SELECT id INTO default_hh_id FROM households LIMIT 1;

    -- Create profiles for existing auth users
    INSERT INTO profiles (id, household_id, display_name)
    SELECT id, default_hh_id, email
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;

    -- Backfill all existing rows
    UPDATE items SET household_id = default_hh_id WHERE household_id IS NULL;
    UPDATE item_stores SET household_id = default_hh_id WHERE household_id IS NULL;
    UPDATE list_items SET household_id = default_hh_id WHERE household_id IS NULL;
    UPDATE shopping_trips SET household_id = default_hh_id WHERE household_id IS NULL;
END $$;

-- 6. SET NOT NULL after backfill
ALTER TABLE items ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE item_stores ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE list_items ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE shopping_trips ALTER COLUMN household_id SET NOT NULL;

-- 7. RLS HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.get_my_household_id() RETURNS UUID AS $$
    SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 8. ENABLE RLS ON NEW TABLES
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 9. DROP OLD POLICIES
DROP POLICY IF EXISTS "Authenticated users can manage items" ON items;
DROP POLICY IF EXISTS "Authenticated users can manage item_stores" ON item_stores;
DROP POLICY IF EXISTS "Users can manage their own list items" ON list_items;
DROP POLICY IF EXISTS "Users can manage their own trips" ON shopping_trips;

-- 10. NEW RLS POLICIES

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can read own profile" ON profiles
    FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated USING (id = auth.uid());
-- Allow insert for signup flow
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Households: readable by all authenticated users (data isolation is on child tables)
-- Must be permissive so new users can look up the default household during signup
CREATE POLICY "Authenticated users can read households" ON households
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create households" ON households
    FOR INSERT TO authenticated WITH CHECK (true);

-- Items: household-scoped
CREATE POLICY "Household members can manage items" ON items
    FOR ALL TO authenticated
    USING (household_id = get_my_household_id())
    WITH CHECK (household_id = get_my_household_id());

-- Item_stores: household-scoped
CREATE POLICY "Household members can manage item_stores" ON item_stores
    FOR ALL TO authenticated
    USING (household_id = get_my_household_id())
    WITH CHECK (household_id = get_my_household_id());

-- List_items: household-scoped
CREATE POLICY "Household members can manage list_items" ON list_items
    FOR ALL TO authenticated
    USING (household_id = get_my_household_id())
    WITH CHECK (household_id = get_my_household_id());

-- Shopping_trips: household-scoped
CREATE POLICY "Household members can manage trips" ON shopping_trips
    FOR ALL TO authenticated
    USING (household_id = get_my_household_id())
    WITH CHECK (household_id = get_my_household_id());

-- 11. ENABLE REALTIME for list_items
-- Note: If list_items is already in the publication, this will error.
-- In that case, skip this statement — it's already configured.
ALTER PUBLICATION supabase_realtime ADD TABLE list_items;
