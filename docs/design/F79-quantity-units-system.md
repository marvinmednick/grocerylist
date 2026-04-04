# Design: Quantity Units System
<!-- ID: F79 | Status: Designed -->

> **Parent architecture doc:** [Vocabulary, Quantity, and Input Interpretation](vocabulary-and-quantity-architecture.md)
> — covers cross-cutting decisions (storage format, vocabulary extensibility, interaction
> model) that span F44, F77, F78, and F79.

---

## Overview

Moves vocabulary data (units, packages, size descriptors) from in-memory constants to
household-scoped database tables, and migrates quantity storage on `list_items` and `items`
from free-form text to structured JSONB fields. Adds a vocabulary management UI ("Sizes &
Packages") so household members can add, edit, delete, and reset vocabulary entries through
a dedicated settings-adjacent screen.

F79 is the second step in the input chain: F44 established the parser and the in-memory
`DEFAULT_VOCABULARY`; F79 makes vocabulary persistent and household-editable, and makes
quantity storage structured so downstream features (F78, F76) can operate on it.

---

## User Scenarios

- A household buys items by the "punnet" — they add "punnet" as a package type so the
  parser recognizes it going forward
- A household member wants to confirm what units and packages the app recognizes before
  typing — they open Sizes & Packages to browse
- A household has added several custom packages over time and wants to reset to the
  standard set — they use Reset to Defaults on the Packages screen
- F78 (duplicate detection) can now add quantities numerically: "1 lb" + "1 lb" → "2 lb",
  because the fields are structured rather than text strings

---

## Design Decisions

### 1 — Vocabulary table DB schema

**Decision:** Three new household-scoped tables replace the existing `units` table:

```sql
CREATE TABLE units (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  canonical    TEXT NOT NULL,
  aliases      TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, canonical)
);

CREATE TABLE packages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  canonical    TEXT NOT NULL,
  aliases      TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, canonical)
);

CREATE TABLE size_descriptors (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  canonical    TEXT NOT NULL,
  aliases      TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, canonical)
);
```

The old `units` table (simple `name/abbreviation` columns, not household-scoped, not
alias-aware) is dropped in the same migration.

**Rationale:** Three separate tables match the three separate lookup functions in the parser
(`lookupUnit`, `lookupPackage`, `lookupSizeDescriptor`). Each type has different semantic
meaning and may gain type-specific fields in the future (e.g., units could gain conversion
factors). A unified table with a type discriminator would conflate them.

**Alternatives considered:** Single `vocabulary_entries (type, canonical, aliases)` table
— rejected because the parser treats the three types distinctly and future extensions are
likely to diverge.

---

### 2 — Household scoping model

**Decision:** Pure household tables (Option A). Each household has its own rows for all
three vocabulary types. At household creation, seed data from `DEFAULT_VOCABULARY` is
copied into the household's rows. Households can then add/edit/delete freely.

**Rationale:** Simple model — one query per household, no union/join between global and
household layers. The vocabulary is not expected to change at the system level frequently
enough to justify propagation complexity. Households who reset to defaults get a fresh copy
of the current seed data.

**Alternatives considered:** Global baseline + household extensions (two-layer merge at
query time) — rejected for added complexity without meaningful benefit given the stability
of the seed data.

---

### 3 — Existing `units` table and orphaned FK columns

**Decision:** Drop the old `units` table. Drop the unused FK columns `items.default_unit_id`
and `list_items.unit_id` in the same migration.

**Rationale:** These columns were initial scaffolding that the parser architecture (F44)
superseded. They have never been wired up in any query or UI. Clean removal prevents
confusion during F79 implementation.

---

### 4 — Structured quantity storage: JSONB

**Decision:** Quantity fields on `list_items` and `items` are stored as JSONB, using the
same `ParsedInput` shape the parser already produces:

```typescript
// ParsedInput shape (from F44 parser output)
{
  count?:          number,   // how many packages/units
  sizeQty?:        number,   // numeric size (e.g., 8 for "8oz")
  sizeUnit?:       string,   // canonical unit (e.g., "oz")
  package?:        string,   // canonical package (e.g., "can")
  sizeDescriptor?: string,   // canonical descriptor (e.g., "large")
  rawInput?:       string,   // fallback: original text if parsing failed
}
```

**Schema changes:**

`list_items` gains:
- `quantity_parsed JSONB NULL` — structured quantity; NULL means use `quantity TEXT` as
  display fallback (unparsed legacy rows)

`items` gains:
- `default_qty_parsed JSONB NULL` — structured form of `default_qty TEXT`
- `alternate_qtys_parsed JSONB[] NULL` — structured form of `alternate_qtys TEXT[]`

The existing TEXT columns (`quantity`, `default_qty`, `alternate_qtys`) are **retained as
display cache / fallback** for this release. They remain the source of display strings for
rows where `_parsed` is NULL. F79 populates `_parsed` at write time going forward and
backfills it for existing rows via migration.

**Rationale:** JSONB fits this app's TypeScript-heavy pattern — mutations go through React
Query hooks, and F78/F76 operations on quantity fields will happen in application code
rather than SQL stored procedures. Fields are sparse (most rows populate only 1–2 of the 5
fields). Schema flexibility is valuable while the `ParsedInput` shape may still evolve
during F77/F83 work.

**Alternatives considered:** Separate columns per field (`quantity_count NUMERIC`,
`quantity_size_qty NUMERIC`, etc.) — more natural SQL filtering, but this app doesn't do
SQL-side quantity math. Rejected in favor of JSONB's compactness and flexibility. Could
migrate to separate columns later if F78/F76 prove to need SQL-side operations.

---

### 5 — Display format: canonical abbreviation

**Decision:** Display always serializes from the structured JSONB fields using canonical
forms. The alias the user typed is not stored or displayed.

- Units: abbreviated canonical form — `"oz"` not `"ounce"`, `"lb"` not `"pound"`
- Packages: singular canonical, pluralized by count — `"can"` → `"cans"` when count > 1
  (via existing `getPlural()` in `vocabulary.ts`)
- Size descriptors: canonical as-is — `"large"`, `"jumbo"`

Examples: `{count: 2, package: "can"}` → `"2 cans"`. `{sizeQty: 1.5, sizeUnit: "lb"}` →
`"1.5 lb"`. `{count: 2, sizeQty: 8, sizeUnit: "oz", package: "bottle"}` → `"2 8oz bottles"`.

For rows where `quantity_parsed` is NULL, the display falls back to the `quantity TEXT`
column (raw string, as today).

**Rationale:** Two household members typing "ounce" and "oz" for the same item produce
identical display strings. Consistent canonical display is also required for F78 duplicate
detection (`quantityEquals` semantic comparison, already in F44).

---

### 6 — Qty presets not used for item search or ranking

**Decision:** Quantity fields (from presets on `items` or parsed input) are not used as a
search or ranking dimension in the dropdown. Item ranking remains name-match-quality only.

**Rationale:** Qty-as-ranking-tiebreaker adds complexity without clear user value — a user
typing "2 cans" already gets "2 cans" pre-selected on matched items regardless of whether
it appears in their presets. Qty-only search (no name tokens) would return noisy results.
This may be revisited under F77 (confidence scoring) if user research shows a need.

---

### 7 — Parser integration

**Decision:** A new React Query hook `useVocabulary()` loads all three vocabulary tables
for the current household (staleTime: 5 min, same as `useMasterItemNames`). It returns a
`Vocabulary` object with the same shape as the current `DEFAULT_VOCABULARY` constant.
`SmartAddItem` passes this hook's result into `parseInput()` in place of
`DEFAULT_VOCABULARY`.

The parser itself (`lib/parser.ts`) is unchanged — it already accepts `vocabulary` as a
parameter. The swap is entirely at the call site.

**Seed data path:** `DEFAULT_VOCABULARY` constants in `vocabulary.ts` remain the source of
truth for seed data and the reset-to-defaults operation. They are not removed.

---

### 8 — Vocabulary management navigation

**Decision:** The avatar menu (currently one item: "Settings") gains a second item:
**"Sizes & Packages"**. "Settings" is renamed **"General"**.

Tapping "Sizes & Packages" opens a dedicated drill-down screen (same full-screen modal
pattern as Settings) with three tappable rows:

```
Sizes & Packages         ×
─────────────────────────
  Units               ›
  Packages            ›
  Sizes               ›
```

Each row opens its own management screen (full-screen modal, same pattern as Store
Management in F19).

**Rationale:** Drill-down screen (established pattern) rather than cascading popover
(novel) — avoids building new popover nesting behavior and matches the existing F19
store management precedent. One extra tap vs. a cascading menu; acceptable trade-off
for a dev/power-user interface.

---

### 9 — Per-vocabulary management screens

Each of the three management screens (Units, Packages, Sizes) is a full-screen modal with:

- **Entry list** — FlatList of current household entries, each row showing the canonical
  and its aliases
- **Add** — button opens a dialog modal (7a pattern) with canonical input + alias chips
- **Edit** — tap an entry row to open the same dialog pre-populated
- **Delete** — destructive icon pill (top-left of edit dialog, Trash2 icon) with
  confirmation
- **Reset to defaults** — button at the bottom of each screen; confirmation dialog before
  proceeding (full replace: all current entries for that type are deleted and seed data
  is re-inserted)

Undo/redo: **not registered** — vocabulary changes are settings-level operations, same as
store create/edit/delete (F19 precedent).

---

### 10 — Entry edit form: editable alias chips

**Decision:** The Add/Edit dialog uses an editable chip list for aliases — an extension of
the established chip selection pattern from SmartAddItem, now with removable chips and an
inline add affordance:

```
Canonical:  [ oz            ]
Aliases:    [ounce ×] [ounces ×] [+ Add alias]
```

- Tap `×` on a chip to remove that alias
- Tap `+ Add alias` → inline TextInput appears; press Return to add; dismiss on blur
- Dialog modal (7a pattern): X close top-right, Cancel + Save in action row

**Pattern classification:** Extension of established chip pattern (adds remove behavior).
New to this app — noted in ui-guidelines.md Decision Log.

---

### 11 — Reset to defaults behavior

**Decision:** Full replace per vocabulary type. All current household entries for the
selected type are deleted; seed data from `DEFAULT_VOCABULARY` is re-inserted. Custom
entries added by the household are lost.

Confirmation dialog text (example for Packages):
*"Reset Packages to defaults? This will remove any custom entries and restore the standard list."*

**Rationale:** Predictable "factory reset" behavior. Non-destructive restore (re-add only
deleted defaults, keep custom) adds complexity and ambiguity (what if a user edited a
default entry?). For a V1 dev interface, full replace is clearer.

---

## Known Limitations

**Vocabulary token / name prefix collision** ([#84](https://github.com/marvinmednick/grocerylist/issues/84)):
When a token exactly matches a vocabulary entry (e.g., "can"), it is classified as PACKAGE
in Pass 2 and removed from name word consideration. This causes the parser to miss items
whose names start with that token (e.g., "Canola Oil"). The fix — generating dual
interpretations when a token matches vocabulary — is a parser enhancement, not an F79
issue. Tracked separately.

---

## Out of Scope

- **On-the-fly vocabulary definition during item add** — F83. F79 provides only the
  management screen; the inline "I don't recognize this token, add it?" flow is F83's work.
- **Unit conversion math** — not attempted in V1. The `sizeUnit` field stores canonical
  strings; numeric conversion between units (e.g., oz → lb) is a future enhancement.
- **Qty-based item search or ranking** — deferred. May be revisited under F77.
- **Global vocabulary update propagation** — not applicable with household-scoped tables.
  System-wide vocabulary improvements are delivered via the Reset to Defaults path.
- **Removing the TEXT display cache columns** (`quantity`, `default_qty`, `alternate_qtys`)
  — deferred. They remain as fallback for legacy rows. Removal is a future cleanup once all
  rows have been backfilled.

---

## Open Questions

None — all questions resolved during design session. Ready for `/spec F79`.

---

## Revision History
- 2026-04-03: Initial design
