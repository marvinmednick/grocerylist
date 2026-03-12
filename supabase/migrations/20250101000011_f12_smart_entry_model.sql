-- F12: Smart Entry Model

-- 1. Add household scope to stores and backfill existing rows
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS stores_household_idx ON stores(household_id);

DO $$
DECLARE
  default_household_id UUID;
BEGIN
  SELECT id INTO default_household_id FROM households ORDER BY created_at LIMIT 1;
  UPDATE stores
  SET household_id = default_household_id
  WHERE household_id IS NULL;
END $$;

ALTER TABLE stores ALTER COLUMN household_id SET NOT NULL;

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_name_key;
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_name_household_unique;
ALTER TABLE stores ADD CONSTRAINT stores_name_household_unique UNIQUE (name, household_id);

-- 2. Replace stores read policy with household CRUD policies
DROP POLICY IF EXISTS "Public read stores" ON stores;
DROP POLICY IF EXISTS "Household members can read stores" ON stores;
DROP POLICY IF EXISTS "Household members can insert stores" ON stores;
DROP POLICY IF EXISTS "Household members can update stores" ON stores;
DROP POLICY IF EXISTS "Household members can delete stores" ON stores;

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

-- 3. Create item_store_preferences with indexes and RLS policy
CREATE TABLE IF NOT EXISTS item_store_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('preferred', 'avoided', 'unavailable')),
  comment TEXT,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  UNIQUE (item_id, store_id)
);

CREATE INDEX IF NOT EXISTS item_store_preferences_item_idx ON item_store_preferences(item_id);
CREATE INDEX IF NOT EXISTS item_store_preferences_household_idx ON item_store_preferences(household_id);

ALTER TABLE item_store_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members can manage item_store_preferences" ON item_store_preferences;
CREATE POLICY "Household members can manage item_store_preferences" ON item_store_preferences
  FOR ALL TO authenticated
  USING (household_id = get_my_household_id())
  WITH CHECK (household_id = get_my_household_id());

-- 4. Migrate preferred associations from item_stores and items.default_store_id
INSERT INTO item_store_preferences (item_id, store_id, status, comment, household_id)
SELECT
  item_stores.item_id,
  item_stores.store_id,
  'preferred',
  NULL,
  COALESCE(item_stores.household_id, items.household_id)
FROM item_stores
JOIN items ON items.id = item_stores.item_id
ON CONFLICT (item_id, store_id) DO UPDATE
SET status = 'preferred';

INSERT INTO item_store_preferences (item_id, store_id, status, comment, household_id)
SELECT
  items.id,
  items.default_store_id,
  'preferred',
  NULL,
  items.household_id
FROM items
WHERE items.default_store_id IS NOT NULL
ON CONFLICT (item_id, store_id) DO UPDATE
SET status = 'preferred';

-- 5. Remove legacy store-link model
DROP TABLE IF EXISTS item_stores;
ALTER TABLE items DROP COLUMN IF EXISTS default_store_id;
