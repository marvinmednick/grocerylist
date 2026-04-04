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
    warning_preferences JSONB DEFAULT '{
      "avoided": "toast_and_badge",
      "unavailable": "toast_and_badge",
      "non_preferred": "badge_only",
      "non_standard_qty": "badge_only"
    }',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX profiles_household_idx ON profiles(household_id);

-- 4. STORES
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color_code TEXT DEFAULT '#000000',
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT stores_name_household_unique UNIQUE (name, household_id)
);
CREATE INDEX stores_household_idx ON stores(household_id);

-- 5. CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. VOCABULARY TABLES
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, canonical)
);
CREATE INDEX units_household_idx ON units(household_id);

CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, canonical)
);
CREATE INDEX packages_household_idx ON packages(household_id);

CREATE TABLE size_descriptors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, canonical)
);
CREATE INDEX size_descriptors_household_idx ON size_descriptors(household_id);

-- 7. ITEMS (Master Database)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    default_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    default_qty TEXT,
    default_qty_parsed JSONB NULL,
    short_name TEXT,
    alternate_qtys TEXT[] DEFAULT '{}',
    alternate_qtys_parsed JSONB[] NULL,
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
    primary_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
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
    quantity_parsed JSONB NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    trip_id UUID REFERENCES shopping_trips(id) ON DELETE SET NULL,
    is_purchased BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    purchased_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    warnings JSONB DEFAULT '[]',
    added_by UUID,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX list_items_household_idx ON list_items(household_id);

-- 10. ITEM_STORE_PREFERENCES
CREATE TABLE item_store_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('preferred', 'avoided', 'unavailable', 'neutral')),
    comment TEXT,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    CONSTRAINT item_store_preferences_item_store_unique UNIQUE (item_id, store_id)
);
CREATE INDEX item_store_preferences_item_idx ON item_store_preferences(item_id);
CREATE INDEX item_store_preferences_household_idx ON item_store_preferences(household_id);

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
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_descriptors ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_store_preferences ENABLE ROW LEVEL SECURITY;

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

-- Public Read (Categories)
CREATE POLICY "Public read categories" ON categories FOR SELECT TO authenticated USING (true);

-- Stores: household-scoped
CREATE POLICY "Household members can read stores" ON stores
    FOR SELECT TO authenticated
    USING (household_id = get_my_household_id());
CREATE POLICY "Household members can insert stores" ON stores
    FOR INSERT TO authenticated
    WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "Household members can update stores" ON stores
    FOR UPDATE TO authenticated
    USING (household_id = get_my_household_id());
CREATE POLICY "Household members can delete stores" ON stores
    FOR DELETE TO authenticated
    USING (household_id = get_my_household_id());

-- Vocabulary: household-scoped
CREATE POLICY "Household members can manage units" ON units
    FOR ALL TO authenticated
    USING (household_id = get_my_household_id())
    WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "Household members can manage packages" ON packages
    FOR ALL TO authenticated
    USING (household_id = get_my_household_id())
    WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "Household members can manage size_descriptors" ON size_descriptors
    FOR ALL TO authenticated
    USING (household_id = get_my_household_id())
    WITH CHECK (household_id = get_my_household_id());

-- Items: household-scoped
CREATE POLICY "Household members can manage items" ON items
    FOR ALL TO authenticated
    USING (household_id = get_my_household_id())
    WITH CHECK (household_id = get_my_household_id());

-- Item store preferences: household-scoped
CREATE POLICY "Household members can manage item_store_preferences" ON item_store_preferences
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
INSERT INTO stores (household_id, name, color_code)
SELECT default_household.id, store_data.name, store_data.color_code
FROM (SELECT id FROM households LIMIT 1) AS default_household
CROSS JOIN (
  VALUES
    ('Costco', '#005596'),
    ('Whole Foods', '#00674b'),
    ('Safeway', '#e31837'),
    ('Trader Joe''s', '#bc2026')
) AS store_data(name, color_code)
ON CONFLICT (name, household_id) DO NOTHING;

-- Vocabulary defaults
DO $$
DECLARE
  hh_id UUID;
BEGIN
  FOR hh_id IN SELECT id FROM households LOOP
    INSERT INTO units (household_id, canonical, aliases) VALUES
      (hh_id, 'oz', ARRAY['ounce', 'ounces']),
      (hh_id, 'lb', ARRAY['lbs', 'pound', 'pounds']),
      (hh_id, 'g', ARRAY['gram', 'grams']),
      (hh_id, 'kg', ARRAY['kilogram', 'kilograms']),
      (hh_id, 'gal', ARRAY['gallon', 'gallons']),
      (hh_id, 'qt', ARRAY['quart', 'quarts']),
      (hh_id, 'pt', ARRAY['pint', 'pints']),
      (hh_id, 'ml', ARRAY['milliliter', 'milliliters']),
      (hh_id, 'L', ARRAY['liter', 'liters']),
      (hh_id, 'cup', ARRAY['cups']),
      (hh_id, 'ct', ARRAY['count']),
      (hh_id, 'floz', ARRAY[]::TEXT[])
    ON CONFLICT (household_id, canonical) DO NOTHING;

    INSERT INTO packages (household_id, canonical, aliases) VALUES
      (hh_id, 'can', ARRAY['cans']),
      (hh_id, 'bottle', ARRAY['bottles']),
      (hh_id, 'jar', ARRAY['jars']),
      (hh_id, 'box', ARRAY['boxes']),
      (hh_id, 'bag', ARRAY['bags']),
      (hh_id, 'carton', ARRAY['cartons']),
      (hh_id, 'tub', ARRAY['tubs']),
      (hh_id, 'container', ARRAY['containers']),
      (hh_id, 'tube', ARRAY['tubes']),
      (hh_id, 'pouch', ARRAY['pouches']),
      (hh_id, 'sleeve', ARRAY['sleeves']),
      (hh_id, 'roll', ARRAY['rolls']),
      (hh_id, 'stick', ARRAY['sticks']),
      (hh_id, 'bar', ARRAY['bars']),
      (hh_id, 'block', ARRAY['blocks']),
      (hh_id, 'loaf', ARRAY['loaves']),
      (hh_id, 'sheet', ARRAY['sheets']),
      (hh_id, 'pack', ARRAY['packs']),
      (hh_id, 'package', ARRAY['packages', 'pkg']),
      (hh_id, 'case', ARRAY['cases']),
      (hh_id, 'flat', ARRAY['flats']),
      (hh_id, 'tray', ARRAY['trays']),
      (hh_id, 'rack', ARRAY['racks']),
      (hh_id, 'dozen', ARRAY[]::TEXT[]),
      (hh_id, 'pair', ARRAY['pairs']),
      (hh_id, 'bunch', ARRAY['bunches']),
      (hh_id, 'head', ARRAY['heads']),
      (hh_id, 'ear', ARRAY['ears']),
      (hh_id, 'stalk', ARRAY['stalks']),
      (hh_id, 'sprig', ARRAY['sprigs']),
      (hh_id, 'clove', ARRAY['cloves']),
      (hh_id, 'fillet', ARRAY['fillets']),
      (hh_id, 'slice', ARRAY['slices']),
      (hh_id, 'patty', ARRAY['patties']),
      (hh_id, 'link', ARRAY['links']),
      (hh_id, 'tablet', ARRAY['tablets']),
      (hh_id, 'capsule', ARRAY['capsules'])
    ON CONFLICT (household_id, canonical) DO NOTHING;

    INSERT INTO size_descriptors (household_id, canonical, aliases) VALUES
      (hh_id, 'large', ARRAY['lg']),
      (hh_id, 'medium', ARRAY['med']),
      (hh_id, 'small', ARRAY['sm']),
      (hh_id, 'xl', ARRAY['extra-large']),
      (hh_id, 'jumbo', ARRAY[]::TEXT[]),
      (hh_id, 'mini', ARRAY['miniature']),
      (hh_id, 'petite', ARRAY[]::TEXT[]),
      (hh_id, 'king-size', ARRAY[]::TEXT[]),
      (hh_id, 'family-size', ARRAY[]::TEXT[]),
      (hh_id, 'travel-size', ARRAY[]::TEXT[]),
      (hh_id, 'regular', ARRAY[]::TEXT[])
    ON CONFLICT (household_id, canonical) DO NOTHING;
  END LOOP;
END $$;
