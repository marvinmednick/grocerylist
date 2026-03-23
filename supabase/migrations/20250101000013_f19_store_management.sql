-- Fix shopping_trips.primary_store_id to allow store deletion
ALTER TABLE shopping_trips
  DROP CONSTRAINT IF EXISTS shopping_trips_primary_store_id_fkey;

ALTER TABLE shopping_trips
  ADD CONSTRAINT shopping_trips_primary_store_id_fkey
    FOREIGN KEY (primary_store_id) REFERENCES stores(id) ON DELETE SET NULL;
