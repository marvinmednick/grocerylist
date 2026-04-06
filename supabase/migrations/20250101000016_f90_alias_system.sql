-- F90: Token + item alias system (Phase A)

-- 1. Household-scoped token aliases
CREATE TABLE word_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  canonical TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX word_aliases_hh_alias_unique
  ON word_aliases (household_id, LOWER(alias));
CREATE INDEX word_aliases_household_idx ON word_aliases(household_id);

ALTER TABLE word_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their household's word aliases"
  ON word_aliases FOR ALL TO authenticated
  USING (household_id = get_my_household_id());

-- 2. Global abbreviation suggestions (read-only to clients)
CREATE TABLE abbreviation_suggestions (
  word TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  PRIMARY KEY (word, suggestion)
);

ALTER TABLE abbreviation_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read abbreviation suggestions"
  ON abbreviation_suggestions FOR SELECT TO authenticated
  USING (true);

-- 3. Item-level aliases
ALTER TABLE items ADD COLUMN aliases TEXT[] NOT NULL DEFAULT '{}';

-- 4. List item alias match metadata
ALTER TABLE list_items ADD COLUMN match_metadata JSONB;
