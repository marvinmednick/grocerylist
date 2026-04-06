# Design: Token & Item Alias System
<!-- ID: F90 | Status: Designed -->
<!-- Parent architecture doc: docs/design/vocabulary-and-quantity-architecture.md -->

## Overview

Two-level alias system for matching user shorthand to known words and products. **Token aliases** map abbreviated words to canonical forms household-wide — "chk" → "chicken" works across all items containing "chicken." **Item aliases** provide alternate names for specific products — "Chicken Tenders" as an alias for "Chicken Breast Strips." Both integrate into the F44 parser pipeline so shorthand input produces the same structured results as fully-typed input.

Aliases are defined deliberately by users through a definition UI that proposes suggestions from a curated reference dataset. The alias table starts empty and grows as users define shortcuts for items they actually use.

---

## User Scenarios

### Scenario A: Token alias — abbreviation matches across items
- **Setup:** User has defined token alias "chk" → "chicken". Master items include "Chicken Breast", "Chicken Thighs", "Chicken Broth".
- **Action:** User types "chk" in SmartAddItem.
- **Expected:** All three chicken items appear in the dropdown, ranked by token coverage. "chk" was expanded to "chicken" before name resolution.

### Scenario B: Multiple token aliases compose
- **Setup:** Token aliases "chk" → "chicken", "brst" → "breast" exist. Master item "Chicken Breast" exists.
- **Action:** User types "2 chk brst".
- **Expected:** "Chicken Breast" appears with qty=2 pre-selected. The parser expanded both abbreviations and matched the 2-token name.

### Scenario C: Partial expansion still produces results
- **Setup:** Token alias "chk" → "chicken" exists, but no alias for "brst". Master items "Chicken Breast" and "Chicken Broth" exist.
- **Action:** User types "chk brst".
- **Expected:** Variant ["chicken", "brst"] matches "Chicken" (1-token, orphan: "brst") via subset matching. "Chicken Breast" may also appear via prefix matching ("brst" is a prefix of "breast"). All results ranked by token coverage.

### Scenario D: Item alias — alternate product name
- **Setup:** Master item "Chicken Breast Strips" has item alias "Chicken Tenders".
- **Action:** User types "chicken tenders".
- **Expected:** "Chicken Tenders" appears in the dropdown (showing the alias name that matched). Tapping it adds the item to the list, displayed as "Chicken Tenders" (the alias that matched). Both the alias name and canonical name ("Chicken Breast Strips") are stored on the list item.

### Scenario E: Token expansion applied to item aliases
- **Setup:** Token aliases "chk" → "chicken", "tndr" → "tenders". Master item "Chicken Breast Strips" has item alias "Chicken Tenders".
- **Action:** User types "chk tndr".
- **Expected:** Token expansion produces variant ["chicken", "tenders"]. This matches item alias "Chicken Tenders" for "Chicken Breast Strips". The item appears in the dropdown.

### Scenario F: Defining token aliases from a master item
- **Action:** User opens the alias definition UI for master item "Chicken Boneless Skinless Breast".
- **Expected:** The words [Chicken] [Boneless] [Skinless] [Breast] are shown as candidates. For each word, the system suggests abbreviations from the reference dataset (e.g., "chk", "chkn" for Chicken; "bnls", "bnless" for Boneless). User accepts or customizes suggestions. Accepted aliases are saved to `word_aliases` and immediately work across all items.

### Scenario G: Token alias from item alias words
- **Setup:** Master item "Chicken Breast Strips" has item alias "Chicken Tenders".
- **Action:** User enters the alias definition flow and sees word pool includes "Tenders" (from the item alias).
- **Expected:** User can define "tndr" → "tenders" as a token alias, even though "tenders" only appears in an alias, not the canonical name.

### Scenario H: Conflict warning on alias creation
- **Action:** User tries to create token alias "can" → "canned".
- **Expected:** Warning: "'can' is also a package type — the alias won't apply when it's used in a quantity context (e.g., '2 cans')." User can proceed or cancel.

---

## Data Model

### `word_aliases` table (household-scoped)

Active alias lookups used at parse time.

```sql
CREATE TABLE word_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  alias TEXT NOT NULL,           -- the shorthand ("chk")
  canonical TEXT NOT NULL,       -- what it expands to ("chicken")
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one canonical per alias per household
CREATE UNIQUE INDEX word_aliases_hh_alias_unique
  ON word_aliases (household_id, LOWER(alias));

-- RLS: same pattern as other household-scoped tables
ALTER TABLE word_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their household's word aliases"
  ON word_aliases FOR ALL
  USING (household_id = get_my_household_id());
```

**Size estimate:** A household might define 20–100 token aliases over time. Each row is ~100 bytes. Total: <10KB. Comfortable for in-memory caching.

**Validation constraints:** Both `alias` and `canonical` must be single tokens — no whitespace allowed. Values are case-folded to lowercase and trimmed on save. Punctuation is stripped. These constraints are enforced in the UI (live validation) and at the API layer. The parser's expansion logic assumes single-token values; multi-word entries would break the cartesian variant model.

### `items.aliases` column

Alternate names for master items. Array column, same pattern as `alternate_qtys`.

```sql
ALTER TABLE items ADD COLUMN aliases TEXT[] NOT NULL DEFAULT '{}';
```

**Examples:**
- "Chicken Breast Strips" → `aliases: ["Chicken Tenders", "Chicken Fingers"]`
- "Peanut Butter" → `aliases: ["PB"]`
- "Scallions" → `aliases: ["Green Onions"]`

### `abbreviation_suggestions` table (global, read-only)

Reference data for proposing aliases during the definition flow. Never consulted at parse time.

```sql
CREATE TABLE abbreviation_suggestions (
  word TEXT NOT NULL,        -- "chicken"
  suggestion TEXT NOT NULL,  -- "chk"
  PRIMARY KEY (word, suggestion)
);

-- No RLS — globally readable, admin-writable only
```

**Size estimate:** ~500–2,000 rows covering common grocery vocabulary. Each row is ~30 bytes. Total: ~30–60KB. Fetched on-demand during alias definition only.

---

## Parser Integration

### Where alias expansion fits in the pipeline

```
Pass 1 — Tokenize
Pass 2 — Per-Token Classification (vocabulary lookup: units, packages, sizes)
Pass 3 — Adjacent Token Grouping
Pass 4 — Candidate Assembly
  ↓
NEW: Token Alias Expansion (between Pass 4 and Pass 5)
  ↓
Pass 5 — Name Resolution (extended: check item aliases too)
Pass 6 — Output
```

Vocabulary classification (Pass 2) runs first and takes priority. If "can" is classified as PACKAGE in Pass 2, it never reaches the alias expansion step. This is correct — vocabulary tokens have structural meaning that aliases should not override.

### Token alias expansion step

After Pass 4 produces a `CandidateFields` with `nameWords`, the expansion step:

1. For each name word, look up `word_aliases` to find its expansion (if any)
2. Build all combinations of original + expanded forms (cartesian product)
3. Each combination becomes a `CandidateFields` variant passed to Pass 5

**Worked example — `"2 chk brst"` with aliases chk→chicken, brst→breast:**

After Pass 4:
```
{ count: 2, nameWords: ["chk", "brst"], ... }
```

Token "chk" has expansion "chicken". Token "brst" has expansion "breast". Build variants:

```
Variant 1: nameWords = ["chk", "brst"]         (no expansions)
Variant 2: nameWords = ["chicken", "brst"]      (expand first token)
Variant 3: nameWords = ["chk", "breast"]        (expand second token)
Variant 4: nameWords = ["chicken", "breast"]    (expand both)
```

Each variant goes through Pass 5 (name resolution). Results from all variants are pooled, deduped by `matchedItemId`, and ranked by longest name match. When the same item is matched with equal token coverage via both canonical name and alias, the canonical name match is preferred (for deterministic output — in practice this is rare since different match paths consume different tokens).

**Complexity:** With N expandable tokens, there are 2^N variants. For typical grocery input (2–4 name tokens), that's 4–16 variants. Each variant's Pass 5 run is a fast set comparison against master items. Non-matching variants are pruned immediately.

**Worked example — results from all four variants:**

Master items: "Chicken", "Chicken Breast", "Chicken Broth"

```
Variant 1: ["chk", "brst"]
  → No master item matches (nothing called "Chk" or "Chk Brst")

Variant 2: ["chicken", "brst"]
  → "Chicken" matches (1-token, orphan: "brst")

Variant 3: ["chk", "breast"]
  → No match (nothing called "Chk Breast" or "Breast")

Variant 4: ["chicken", "breast"]
  → "Chicken Breast" matches (2-token, no orphans)
  → "Chicken" matches (1-token, orphan: "breast")
```

Pooled and deduped results, ranked by token coverage:
```
1. "Chicken Breast" — 2-token match (from variant 4)
2. "Chicken" — 1-token match (from variant 2 or 4, deduped)
```

### Item alias matching in Pass 5

`resolveNames` currently iterates all master items and compares name tokens. Item aliases are flattened into the same lookup structure — each alias is treated as an alternate "name" for the same item.

**Flattening example:**

Master item:
```
{ id: "abc", name: "Chicken Breast Strips", aliases: ["Chicken Tenders", "Chicken Fingers"] }
```

Flattened for lookup:
```
{ id: "abc", name: "Chicken Breast Strips", matchedVia: "name" }
{ id: "abc", name: "Chicken Tenders", matchedVia: "alias" }
{ id: "abc", name: "Chicken Fingers", matchedVia: "alias" }
```

All three entries are checked during name resolution. If "Chicken Tenders" matches, the result carries both the matched alias name and the canonical name.

### ParsedInput extensions

```typescript
export interface ParsedInput {
  // existing fields...
  name: string;              // display name — alias if matched via alias, canonical otherwise
  canonicalName: string;     // always the master item's real name
  matchedItemId: string | null;
  matchedVia: 'name' | 'alias';  // how we got here

  // When matchedVia === 'name': name === canonicalName
  // When matchedVia === 'alias': name is the alias, canonicalName is the real item name
}
```

**Dropdown display:** Shows `name` (the alias that matched — option B).
**Adding to list:** Links via `matchedItemId` to the master item. The list item stores both `name` (alias that matched) and `canonicalName` (master item's real name). Display shows the alias name — the name the user typed/recognized. Display strategy can be changed later without data model changes since both names are persisted.
**Item edit screen:** Shows both canonical name and which alias was matched.
**Audit:** `matchedVia` field records how the match occurred ('name' or 'alias').

**Schema note:** The `list_items` table will need columns to persist alias provenance (matched name, canonical name, match method). Exact column definitions are deferred to the spec — the design establishes what gets stored and why; the spec defines the schema.

**Snapshot behavior:** List items preserve the name they were added with. If a master item is later renamed or an alias is removed, existing list items keep their historical `name` and `canonicalName` values. This is consistent with how `list_items.name` already works (snapshot at add time, not a live lookup) and with architecture principle #4 ("parse once, use everywhere").

---

## Alias Definition Flow

### Core model

Aliases are not seeded — the table starts empty. Users define aliases deliberately, with the system helping by suggesting common abbreviations.

The **word pool** for token alias creation is drawn from:
1. Words in master item names (primary source)
2. Words in item aliases (secondary — e.g., "tenders" from alias "Chicken Tenders")

The system proposes suggestions from the `abbreviation_suggestions` reference table. The user accepts, rejects, or customizes each suggestion. They can also type custom aliases without a suggestion.

### Entry points

1. **From avatar menu** — "Abbreviations" top-level menu item → opens abbreviations screen with empty search (browse all)
2. **From a master item** — "Define Abbreviations" button on item edit modal → opens abbreviations screen with search pre-populated from item's words
3. **[Future] From search miss** — user types something with no matches, system offers to define aliases (overlaps with F83)

### Suggestion reference dataset

The `abbreviation_suggestions` table is curated, global, read-only. It provides suggestions like:

| Word | Suggestions |
|------|-------------|
| chicken | chk, chkn |
| boneless | bnls, bnless |
| skinless | sknls |
| breast | brst |
| organic | org |
| vegetable | veg |
| avocado | avo |
| chocolate | choc |
| broccoli | broc |
| strawberry | straw |
| pepper | pep |
| thigh | thgh |

This data is queried on-demand during the alias definition flow only — never at parse time, never cached at startup. The table can grow over time without affecting parse performance.

### Workflow example

User opens alias definition for "Chicken Boneless Skinless Breast":

```
Word pool: [Chicken] [Boneless] [Skinless] [Breast]

Chicken — suggestions: chk, chkn
  User accepts: chk, chkn  → saves word_aliases: chk→chicken, chkn→chicken

Boneless — suggestions: bnls, bnless
  User accepts: bnls       → saves word_alias: bnls→boneless
  User skips: bnless

Skinless — suggestions: sknls
  User accepts: sknls      → saves word_alias: sknls→skinless

Breast — suggestions: brst
  User types custom: bst   → saves word_alias: bst→breast
  User accepts: brst       → saves word_alias: brst→breast
```

After this session, any input containing "chk", "chkn", "bnls", "sknls", "brst", or "bst" will expand before name resolution — across all items, not just this one.

---

## Conflict Checking

### When creating a token alias

| Conflict type | Severity | Behavior | Example |
|--------------|----------|----------|---------|
| **Alias key already exists** | **Block** | Must delete or update existing alias first. One canonical per alias per household. | "chk" already maps to "chicken" — can't also map to "chuck" |
| **Alias matches a vocabulary token** | **Warn** | Informational — Pass 2 classification takes priority, so the alias won't fire in quantity contexts. | "'can' is also a package type — the alias won't apply when used in quantity context (e.g., '2 cans')" |
| **Alias matches word in master item names** | **Warn** | Informational — alias expansion is additive, so existing matches aren't broken. But user should understand the scope. | "'broth' appears in 3 of your items — this alias will affect how those items are found" |

### When creating an item alias

| Conflict type | Severity | Behavior | Example |
|--------------|----------|----------|---------|
| **Alias matches another item's name or alias** | **Warn** | Two items with the same name/alias will both appear in results — the user picks. | "'Chicken Tenders' is already a name/alias for 'Chicken Tender Strips'" |

---

## Caching and Performance

### Parse-time data loading

| Data | Loaded when | Cache strategy | Size |
|------|-------------|---------------|------|
| `word_aliases` | App startup / first parse | React Query hook (`useWordAliases`), long stale time, invalidated on write | 20–100 rows, <10KB |
| `items.aliases` | Already loaded via `useMasterItemNames` | Extend existing hook to include aliases column | Adds ~50 bytes per item |
| `abbreviation_suggestions` | On-demand during alias definition UI | Fetched when user opens definition flow, not cached long-term | 500–2,000 rows, ~60KB |

The parser function signature extends from:
```typescript
parseInput(input, vocabulary, masterItems) → ParseResult
```
to:
```typescript
parseInput(input, vocabulary, wordAliases, masterItems) → ParseResult
```

Where `wordAliases` is a `Map<string, string>` (alias → canonical) built from the query results.

---

## Design Decisions

### Token aliases are household-scoped and global
**Decision:** Token aliases apply to all items in the household, not scoped to individual items. The item edit screen is one entry point for creating them, but once created, an alias works everywhere.
**Rationale:** "chk" → "chicken" should match Chicken Breast, Chicken Thighs, Chicken Broth — not just the item the user happened to be editing. Token aliases are word-level vocabulary, not item-level metadata.
**Alternatives considered:** Per-item aliases would avoid cross-item side effects but don't compose — each item would need its own "chk" alias.

### Alias table starts empty — no seed data
**Decision:** No pre-populated token aliases. The `word_aliases` table starts empty for every household. The `abbreviation_suggestions` table (global, read-only) provides suggestions during the definition flow.
**Rationale:** A seeded alias table would contain shortcuts for words the household may never use. Aliases are personal shorthand — "chk" means "chicken" to one household but might not be intuitive to another. Deliberate definition (principle #3) over assumed defaults.
**Alternatives considered:** Seeding common abbreviations (chk/chicken, bnls/boneless, etc.). Rejected because most households use a small subset of grocery vocabulary, and a large seed list would be noise.

### Expansion is additive — try all combinations
**Decision:** When a name token has an alias, the parser tries both the original token and the expanded form. All combinations are generated and each goes through name resolution.
**Rationale:** Partial expansions still produce useful results. "chicken" (expanded from "chk") matches "Chicken" as a 1-token match even when the full expansion "chicken breast" (from "chk brst") produces a better 2-token match. The existing ranking rule (longest match first) handles ordering naturally.
**Alternatives considered:** Substitutive expansion (replace original with expanded form). Rejected because it would miss cases where the unexpanded token is itself a valid name or prefix.

### Vocabulary classification takes priority over alias expansion
**Decision:** Pass 2 (token classification) runs before alias expansion. If "can" is classified as PACKAGE, it never reaches the alias step.
**Rationale:** Vocabulary tokens have structural meaning (they affect how the parser assigns grammar roles). An alias for "can" would silently break quantity parsing ("2 cans chicken" would lose the package classification). The warning at alias creation time makes this visible to the user.
**Alternatives considered:** Allowing aliases to override vocabulary classification. Rejected as too dangerous — it would silently break parsing for common vocabulary words.

### Item aliases stored as TEXT[] column
**Decision:** `items.aliases TEXT[] NOT NULL DEFAULT '{}'` — array column on the items table.
**Rationale:** Same pattern as `alternate_qtys`. Aliases are looked up in the same iteration loop as name matching (flattened into the master items list), so no join query is needed. The array is small (typically 0–3 aliases per item).
**Alternatives considered:** Join table (`item_aliases`). Would allow indexed lookup by alias string, but we're already doing a full scan for name matching — adding aliases to the same loop is cheap.

### Dropdown shows alias name when matched via alias
**Decision:** When an item is matched through its alias, the dropdown shows the alias name (e.g., "Chicken Tenders"), not the canonical name ("Chicken Breast Strips").
**Rationale:** The user typed something that matched the alias — showing the alias name makes it clear why the result appeared. The alias name is also what displays on the list item after adding. Both alias and canonical names are stored on the list item, so the display strategy can change later without data model changes.
**Alternatives considered:** (A) Show canonical name — user doesn't understand why result appeared. (C) Show both — adds visual complexity to the dropdown row. Decided to start with (B) and revisit if users are confused about what they're adding.

### ParsedInput carries match provenance
**Decision:** `ParsedInput` extended with `canonicalName`, `matchedVia` ('name' | 'alias') fields. `name` holds the display name (alias if matched via alias). `canonicalName` always holds the master item's real name.
**Rationale:** Separating display name from canonical name allows both the dropdown and the list item to show the alias the user recognized, while maintaining the link to the master item via `matchedItemId` and `canonicalName`. Storing `matchedVia` provides an audit trail and enables changing the display strategy later without data model changes.

### Alias CRUD is settings-level — no undo/redo
**Decision:** Creating, editing, and deleting aliases is not registered with the undo/redo stack.
**Rationale:** Aliases are household-level vocabulary configuration, not per-session shopping actions. Same treatment as vocabulary management (F79) — settings-level operations where undo doesn't apply.

### Conflict checking: block duplicate keys, warn on everything else
**Decision:** Creating a token alias with a key that already exists is blocked (one canonical per alias per household). Conflicts with vocabulary tokens or master item names produce informational warnings but don't block.
**Rationale:** Duplicate alias keys are a hard conflict — two different expansions for the same input would be ambiguous. Vocabulary and item name conflicts are soft — the alias still works, just not in all contexts (vocabulary takes priority) or with side effects the user should be aware of.

---

## Out of Scope

- **Fuzzy/edit-distance matching on aliases** — F77 scope. F77 will apply fuzzy matching to alias table entries (e.g., "ckn" fuzzy-matches alias "chkn" → "chicken").
- **Unrecognized token classification modal** — F83 scope. The "what role is this unknown word?" flow is independent of abbreviation aliases.
- **Plural normalization** — F77 scope. Suffix stripping ("breasts" → "breast") is a matching improvement, not an alias feature.
- **Two-category dropdown presentation** — F77 scope. The visual distinction between "known" and "suggested" match sections depends on fuzzy matching confidence scoring.

---

## UI Design

### Item Edit Modal — Alias Sections

Two new sections added to the master item edit modal:

**"Also known as" section** — Editable item alias chips.
- Chip row showing existing item aliases, each with `×` to remove
- `+ Add alias` at end — tap opens inline text input, Return to confirm
- Empty state: just the `+ Add alias` button
- **Pattern:** Established editable alias chips from F79 (see ui-guidelines.md Decision Log)

**"Active Abbreviations" section** — Read-only reference showing token aliases relevant to this item's words.
- Lists canonical words from this item's name (and item aliases) that have defined token aliases
- Format: `chicken → chk, chkn` (read-only text, not editable here)
- Empty state: "No abbreviations defined for this item's words"
- **"Define Abbreviations" button** — launches the Abbreviations screen with search pre-populated from this item's words

### Avatar Menu — "Abbreviations" Entry

New top-level menu item in the avatar popover menu, alongside "General" and "Sizes & Packages".

- Tap → opens the Abbreviations screen (full-screen modal)
- **Pattern:** Extension of established avatar menu structure from F79

### Abbreviations Screen (Full-Screen Modal)

The primary management UI for token aliases. Reached from the avatar menu (empty search) or from an item edit (pre-populated search). Same screen, different entry states.

**Layout (§7b full-screen modal):**
```
┌─────────────────────────────────────┐
│ Abbreviations           [toggle] [X]│
│ ┌─────────────────────────────────┐ │
│ │ 🔍 Search...                    │ │
│ └─────────────────────────────────┘ │
│                                     │
│  chicken         [chk] [chkn]       │
│  boneless        [bnls]             │
│  skinless        (no aliases)       │
│  breast          [brst] [bst]       │
│                                     │
└─────────────────────────────────────┘
```

**Toggle** — switches between two views. Each view maintains its own independent search state — toggling does not transfer or cross-populate search terms.
- **Canonical → Aliases** (default): Rows keyed by canonical word, each showing its alias chips. Search matches canonical words.
- **Alias → Canonical**: Rows keyed by individual alias, each showing its canonical target. Search matches alias strings.

**Search bar:**
- OR semantics — "chicken breast" shows rows matching "chicken" OR "breast"
- Searches whichever column the current view is keyed on (canonical words in default view, aliases in flipped view)
- **Creates placeholder rows for search terms that don't have entries yet.** Works in both views:
  - In canonical→aliases view: typing "boneless" when no alias exists creates a placeholder row: `boneless (no aliases)`. Tappable to define aliases for that word.
  - In alias→canonical view: typing "brth" when no such alias exists creates a placeholder row: `brth (undefined)`. Tappable to define what canonical word it maps to.
- **Unknown word warning:** If a search term doesn't appear in any master item name or item alias in the household, the placeholder row shows an inline warning: `"xyz" doesn't appear in any of your items`. The user can still proceed (preemptive alias definition is allowed).

**Tap a row → Edit dialog:**

Opens a dialog modal (§7a) for that canonical word:
```
┌──────────────────────────────┐
│ chicken                   [X]│
│                              │
│ Aliases:                     │
│ [chk ×] [chkn ×]            │
│                              │
│ ┌──────────────────────────┐ │
│ │ Add alias...             │ │
│ └──────────────────────────┘ │
│ ⚠ "can" is also a package   │  ← inline conflict warning
│   type — alias won't apply  │    (live-updates as user types)
│   in quantity contexts      │
│                              │
│ Suggestions: chk  chkn      │  ← from abbreviation_suggestions
│                              │
│           [Cancel] [Save]    │
└──────────────────────────────┘
```

- **Canonical word:** Read-only when editing existing entry. Editable (text field) for new entries created via search placeholder.
- **Alias chips:** Existing aliases shown as removable chips (`×` to delete)
- **Text input:** Type a new alias, Return to add as chip
- **Suggestions:** Shown from `abbreviation_suggestions` table for this canonical word. Tappable to accept (adds as chip). Only shown if suggestions exist.
- **Conflict warnings:** Inline text below the input field, live-updating per keystroke as the user types:
  - **Blocking (red):** "An alias 'chk' already exists (→ chicken)" — Save disabled
  - **Vocabulary conflict (amber):** "'can' is also a package type — alias won't apply in quantity contexts (e.g., '2 cans')"
  - **Item name conflict (amber):** "'broth' appears in 3 of your items — this alias will affect how those items are found"
  - **Unknown canonical word (amber):** "'xyz' doesn't appear in any of your items"

**Item-launch behavior:**
When opened from the item edit modal's "Define Abbreviations" button:
- Search bar is pre-populated with the item's words (from canonical name + item aliases)
- All words appear as rows — some with existing aliases, some as placeholders
- On close, returns to the item edit modal

### UI Classification Summary

| Surface | Classification | Pattern reference |
|---------|---------------|-------------------|
| Item alias chips ("Also known as") | **Established** | Editable alias chips (F79, ui-guidelines.md Decision Log) |
| Active Abbreviations (read-only) | **Established** | Read-only text list in modal section |
| Avatar menu "Abbreviations" item | **Extension** | Avatar menu structure (F79) — adding a 3rd top-level item |
| Abbreviations screen | **Extension** | Full-screen modal (§7b) + search/filter list |
| Edit dialog | **Established** | Dialog modal (§7a) + editable chips + inline text input |
| Conflict warnings | **Extension** | Inline validation text, live-updating — extends existing warning patterns |

## Open Questions

1. **`abbreviation_suggestions` initial dataset** — Who curates the initial set? What's the coverage target? Should there be categories or ranking? (Can be deferred to spec time)

---

## Revision History
- 2026-04-05: Initial DRAFT — established from F77 design conversation. Token alias and item alias models defined. Parser integration designed (variant expansion between Pass 4 and Pass 5, item alias flattening in Pass 5). Data model defined (word_aliases table, items.aliases column, abbreviation_suggestions table). Alias definition flow conceptualized. Conflict checking rules established.
- 2026-04-05: Pass 2 — UI design complete. Abbreviations screen as unified management + definition surface (full-screen modal with toggle views, OR search, placeholder rows for new words). Item edit modal gains "Also known as" chips and read-only "Active Abbreviations" section. Avatar menu gets "Abbreviations" top-level item. Conflict warnings are inline, live-updating. All surfaces classified against ui-guidelines.md. One open question remains (abbreviation_suggestions dataset curation, deferred to spec).
- 2026-04-05: Design review fixes — (1) Added single-token validation constraints on word_aliases (no whitespace, case-folded, trimmed, no punctuation). (2) Added dedupe precedence rule: canonical name match preferred at equal coverage. (3) Clarified toggle has independent search states per view, no cross-population; placeholder rows work in both views. (4) Added schema note: list_items columns for alias provenance deferred to spec. (5) Added snapshot behavior: list items preserve historical name/alias at add time, not refreshed on rename/removal.
