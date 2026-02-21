-- ============================================================
-- Full Schema (combined from all migrations)
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. HOUSEHOLDS
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT DEFAULT 'My Household',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROFILES
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX profiles_household_idx ON profiles(household_id);

-- 4. STORES
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color_code TEXT DEFAULT '#000000',
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. UNITS
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    abbreviation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ITEMS (Master Database)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    default_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    default_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    default_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    default_qty TEXT,
    alternate_qtys TEXT[] DEFAULT '{}',
    search_tokens TSVECTOR,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT items_name_household_unique UNIQUE (name, household_id)
);
CREATE INDEX items_search_idx ON items USING GIN (search_tokens);
CREATE INDEX items_household_idx ON items(household_id);

-- 8. SHOPPING TRIPS
CREATE TABLE shopping_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    primary_store_id UUID REFERENCES stores(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'retroactive')),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX shopping_trips_household_idx ON shopping_trips(household_id);

-- 9. LIST ITEMS (The Active Shopping List)
CREATE TABLE list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity TEXT,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    trip_id UUID REFERENCES shopping_trips(id) ON DELETE SET NULL,
    is_purchased BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    purchased_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    added_by UUID,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX list_items_household_idx ON list_items(household_id);

-- 10. ITEM_STORES (Many-to-Many)
CREATE TABLE item_stores (
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT FALSE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, store_id)
);

-- ============================================================
-- RLS Helper Function
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_household_id() RETURNS UUID AS $$
    SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_stores ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can read own profile" ON profiles
    FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Households: readable by all authenticated (data isolation is on child tables)
CREATE POLICY "Authenticated users can read households" ON households
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create households" ON households
    FOR INSERT TO authenticated WITH CHECK (true);

-- Public Read (Categories, Stores, Units)
CREATE POLICY "Public read categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read stores" ON stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read units" ON units FOR SELECT TO authenticated USING (true);

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

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE list_items;

-- ============================================================
-- Seed Data
-- ============================================================

-- Default Household
INSERT INTO households (name) VALUES ('My Household');

-- Categories
INSERT INTO categories (name, sort_order) VALUES
('Produce', 10),
('Dairy', 20),
('Meat', 30),
('Bakery', 40),
('Frozen', 50),
('Pantry', 60),
('Household', 70),
('Other', 99)
ON CONFLICT (name) DO NOTHING;

-- Stores
INSERT INTO stores (name, color_code) VALUES
('Costco', '#005596'),
('Whole Foods', '#00674b'),
('Safeway', '#e31837'),
('Trader Joe''s', '#bc2026')
ON CONFLICT (name) DO NOTHING;

-- Units
INSERT INTO units (name, abbreviation) VALUES
('Pounds', 'lbs'),
('Ounces', 'oz'),
('Grams', 'g'),
('Kilograms', 'kg'),
('Count', 'x'),
('Packages', 'pkgs'),
('Cans', 'cans'),
('Bags', 'bags'),
('Gallons', 'gal'),
('Quarts', 'qt')
ON CONFLICT (name) DO NOTHING;
