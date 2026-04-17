BEGIN;

CREATE TABLE list_item_quantities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_item_id UUID NOT NULL REFERENCES list_items(id) ON DELETE CASCADE,
    quantity TEXT,
    quantity_parsed JSONB NULL,
    is_purchased BOOLEAN DEFAULT FALSE,
    purchased_at TIMESTAMPTZ,
    purchased_by UUID,
    trip_id UUID REFERENCES shopping_trips(id) ON DELETE SET NULL,
    archived_at TIMESTAMPTZ,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX list_item_quantities_list_item_idx ON list_item_quantities(list_item_id);
CREATE INDEX list_item_quantities_household_idx ON list_item_quantities(household_id);
CREATE INDEX list_item_quantities_active_idx ON list_item_quantities(archived_at) WHERE archived_at IS NULL;

ALTER TABLE list_item_quantities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can manage list_item_quantities" ON list_item_quantities
    FOR ALL TO authenticated
    USING (household_id = get_my_household_id())
    WITH CHECK (household_id = get_my_household_id());

ALTER PUBLICATION supabase_realtime ADD TABLE list_item_quantities;

INSERT INTO list_item_quantities (
    list_item_id,
    quantity,
    quantity_parsed,
    is_purchased,
    purchased_at,
    purchased_by,
    trip_id,
    archived_at,
    added_at,
    added_by,
    household_id
)
SELECT
    keeper.id,
    dup.quantity,
    dup.quantity_parsed,
    dup.is_purchased,
    dup.purchased_at,
    dup.purchased_by,
    dup.trip_id,
    dup.archived_at,
    dup.added_at,
    dup.added_by,
    dup.household_id
FROM list_items dup
JOIN LATERAL (
    SELECT id
    FROM list_items k
    WHERE k.item_id = dup.item_id
      AND k.store_id IS NOT DISTINCT FROM dup.store_id
      AND k.household_id = dup.household_id
      AND k.archived_at IS NULL
      AND k.item_id IS NOT NULL
    ORDER BY k.added_at ASC, k.id ASC
    LIMIT 1
) keeper ON TRUE
WHERE dup.archived_at IS NULL
  AND dup.item_id IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM list_items sibling
      WHERE sibling.item_id = dup.item_id
        AND sibling.store_id IS NOT DISTINCT FROM dup.store_id
        AND sibling.household_id = dup.household_id
        AND sibling.archived_at IS NULL
        AND sibling.item_id IS NOT NULL
        AND sibling.id <> dup.id
  );

DELETE FROM list_items
WHERE id IN (
    SELECT dup.id
    FROM list_items dup
    JOIN LATERAL (
        SELECT id
        FROM list_items k
        WHERE k.item_id = dup.item_id
          AND k.store_id IS NOT DISTINCT FROM dup.store_id
          AND k.household_id = dup.household_id
          AND k.archived_at IS NULL
          AND k.item_id IS NOT NULL
        ORDER BY k.added_at ASC, k.id ASC
        LIMIT 1
    ) keeper ON TRUE
    WHERE dup.archived_at IS NULL
      AND dup.item_id IS NOT NULL
      AND dup.id <> keeper.id
);

INSERT INTO list_item_quantities (
    list_item_id,
    quantity,
    quantity_parsed,
    is_purchased,
    purchased_at,
    purchased_by,
    trip_id,
    archived_at,
    added_at,
    added_by,
    household_id
)
SELECT
    id,
    quantity,
    quantity_parsed,
    is_purchased,
    purchased_at,
    purchased_by,
    trip_id,
    archived_at,
    added_at,
    added_by,
    household_id
FROM list_items;

ALTER TABLE list_items
    DROP COLUMN quantity,
    DROP COLUMN quantity_parsed,
    DROP COLUMN is_purchased,
    DROP COLUMN purchased_at,
    DROP COLUMN purchased_by,
    DROP COLUMN trip_id;

CREATE OR REPLACE FUNCTION archive_empty_list_items()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE list_items
    SET archived_at = NOW()
    WHERE archived_at IS NULL
      AND NOT EXISTS (
          SELECT 1
          FROM list_item_quantities q
          WHERE q.list_item_id = list_items.id
            AND q.archived_at IS NULL
      );
$$;

COMMIT;
