-- F16: Store Preferences UI Redesign
-- Allow neutral status rows in item_store_preferences so that
-- comments can be stored for stores with no explicit preference.

ALTER TABLE item_store_preferences
  DROP CONSTRAINT IF EXISTS item_store_preferences_status_check;

ALTER TABLE item_store_preferences
  ADD CONSTRAINT item_store_preferences_status_check
    CHECK (status IN ('preferred', 'avoided', 'unavailable', 'neutral'));
