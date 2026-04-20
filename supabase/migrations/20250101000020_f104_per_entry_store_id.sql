BEGIN;

ALTER TABLE list_item_quantities
ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX list_item_quantities_store_idx ON list_item_quantities(store_id);

UPDATE list_item_quantities liq
SET store_id = li.store_id
FROM list_items li
WHERE liq.list_item_id = li.id;

UPDATE list_items
SET store_id = NULL;

COMMIT;
