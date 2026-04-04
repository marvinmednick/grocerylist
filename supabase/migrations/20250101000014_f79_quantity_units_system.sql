-- F79: Quantity Units System
-- Drops old units table and unused FK columns.
-- Creates household-scoped vocabulary tables (units, packages, size_descriptors).
-- Adds JSONB quantity columns to list_items and items.
-- Seeds vocabulary for all existing households.

-- Step 1: Remove old units RLS policy
DROP POLICY IF EXISTS "Public read units" ON units;

-- Step 2: Drop unused FK columns
ALTER TABLE items DROP COLUMN IF EXISTS default_unit_id;
ALTER TABLE list_items DROP COLUMN IF EXISTS unit_id;

-- Step 3: Drop old units table
DROP TABLE IF EXISTS units;

-- Step 4: Create household-scoped vocabulary tables
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

-- Step 5: Enable RLS on new tables
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_descriptors ENABLE ROW LEVEL SECURITY;

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

-- Step 6: Add JSONB quantity columns
-- NULL means "use the TEXT column as display fallback" (pre-F79 rows, one-off adds).
-- Populated at write time by a future spec; here the columns are created.
ALTER TABLE list_items ADD COLUMN quantity_parsed JSONB NULL;
ALTER TABLE items ADD COLUMN default_qty_parsed JSONB NULL;
ALTER TABLE items ADD COLUMN alternate_qtys_parsed JSONB[] NULL;

-- Step 7: Seed vocabulary for all existing households
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
