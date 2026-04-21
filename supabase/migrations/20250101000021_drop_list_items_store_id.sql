-- #106: Drop deprecated list_items.store_id column.
-- This column has been NULL for all rows since the F104 migration
-- (20250101000020). Store assignment now lives on list_item_quantities.
ALTER TABLE list_items DROP COLUMN store_id;
