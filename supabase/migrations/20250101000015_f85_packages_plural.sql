-- F85: Add explicit plural column to packages table.
-- Eliminates the implicit first-alias convention for plural forms.

-- Add column (temporarily nullable to allow UPDATE)
ALTER TABLE packages ADD COLUMN plural TEXT;

-- Populate from first alias; fall back to canonical || 's'
UPDATE packages SET plural = COALESCE(aliases[1], canonical || 's');

-- Make NOT NULL now that all rows have a value
ALTER TABLE packages ALTER COLUMN plural SET NOT NULL;

-- Remove plural from aliases (no longer needed there — parser now checks plural directly)
UPDATE packages SET aliases = array_remove(aliases, plural);
