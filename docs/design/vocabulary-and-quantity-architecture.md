# Architecture: Vocabulary, Quantity, and Input Interpretation

<!-- Status: DRAFT — Established 2026-03-31, active design conversation -->

> Cross-cutting architectural document. Covers the philosophy and long-term model for how
> the app handles vocabulary (units, packages, size descriptors), quantity storage and
> display, and user interaction when input doesn't match known entities.
>
> **Related features:** F44 (free-form parsing), F77 (fuzzy matching), F78 (duplicate
> handling), F79 (quantity units system)

---

## Core Philosophy

The app maintains **vocabulary tables** (units, packages, size descriptors) and a
**master items dictionary** that together define the recognized entities in the system.
User input is parsed against these tables to extract structured meaning. When input
doesn't match known vocabulary, the user is presented with options to clarify — following
the same pattern used for products today (match existing or add new).

**Key principles:**

1. **The user always confirms.** The system suggests interpretations; the user selects.
   No silent assumptions about ambiguous input.
2. **One-off is always frictionless.** Adding a raw string to the shopping list (without
   defining vocabulary or master items) must be as fast as it is today — one tap.
3. **Defining new vocabulary is deliberate.** Adding to master tables (products, packages,
   units) goes through a separate UI flow, not inline in the dropdown. This prevents
   accidental vocabulary pollution.
4. **Parse once, use everywhere.** The parser normalizes input at write time. Downstream
   consumers (display, merge, recipe scaling) work from the stored result, not by
   re-parsing strings.

---

## Vocabulary Tables

Three vocabulary tables support token classification during parsing:

| Table | Purpose | Examples | Extensibility |
|-------|---------|----------|---------------|
| **Units** | Measurement units with aliases | oz/ounce/ounces, lb/lbs/pound, gal/gallon | Curated seed data; editable via dedicated settings UI, not on-the-fly during item add. Near-complete coverage expected from seed data. |
| **Packages** | Container and sales-unit words | can/cans, bottle/bottles, bag/bags, bunch | Household-extensible via definition flow |
| **Size Descriptors** | Qualitative physical size words | large, small, jumbo, mini, family-size | Household-extensible via definition flow |

All vocabulary tables are **household-scoped** — each household can extend them
independently. Seed data provides a shared starting point.

**Units differ from packages and size descriptors.** Units are measurement systems
(oz, lb, gal) where correctness matters for math (conversion, addition). Packages and
size descriptors are descriptive labels where user-defined additions are low-risk.
Therefore:
- **Packages and size descriptors:** extensible on-the-fly through the vocabulary
  definition flow (see below)
- **Units:** editable through a dedicated settings/management UI, not during the item
  add flow. This avoids casual additions to a table that affects computation.

---

## Quantity Storage: Structured

**Decision:** Quantity storage should be structured, not free-form text. The parser is
the normalization layer for the data model — its structured output is what gets stored.
Display strings are rendered from structure at display time (serialization), not stored
as the source of truth.

**Rationale:** The parser, vocabulary tables, and structured storage form a coherent
system. The architectural decision drives the feature decisions, not the other way around:

- **The parser already produces structure.** Storing it as text discards normalization
  that was already done, forcing re-parsing for any downstream consumer that needs it.
- **Multiple consumers need structure** — F78 (duplicate merge math), F76 (recipe
  scaling), warning system (non-standard qty checks), pill pre-selection, edit modal
  pre-fill, potential unit conversion. Only display needs a rendered string.
- **Normalization should happen once.** Storing text means every consumer that needs
  structure must independently re-parse and re-normalize. Storing structure means
  normalization happens at write time and is authoritative.
- **Serialize/deserialize cost is manageable either way.** Rendering "2 8oz cans" from
  `{count: 2, sizeQty: 8, sizeUnit: "oz", package: "can"}` is a simple function.
  The complexity delta is small and bounded.

**What this means concretely:**

- `list_items` will gain structured quantity fields (exact schema TBD under F79 — could
  be additional columns or JSONB). The existing `quantity` TEXT column may be retained as
  a display cache or removed.
- `items.alternate_qtys` will follow the same pattern for consistency — structured entries
  rather than free-form strings. Exact migration is F79 scope.
- The existing unused `list_items.unit_id` and `items.default_unit_id` columns (FK to
  `units` table) are placeholders from initial scaffolding. F79 will decide whether to
  wire them into the structured model or replace them.

**Migration path:** Existing free-form `quantity` and `alternate_qtys` values will be
parsed through F44 during a one-time migration. Values that don't parse cleanly are
preserved as-is (raw string fallback) and flagged for manual review.

**Interim state:** Until F79 implements the schema change, F44 and other features may
store quantity as serialized text strings. This is a transitional state, not the target
architecture. Features should design their parser output and internal representations
to be structure-ready even if the DB column is still TEXT.

---

## User Interaction Model: Input Interpretation

When the user types into the add-item field, the system interprets the input and presents
results. The interaction varies based on how well the input matches known vocabulary and
master items.

### The Dropdown: Two Categories of Results

The dropdown shows results in two groups:

1. **Known matches** — items where all tokens resolved cleanly against vocabulary tables
   and master items. These appear the same as today's search results, enriched with
   parsed context (qty, package, store displayed alongside the item name).

2. **Fuzzy / suggested matches** — items where one or more tokens required fuzzy matching,
   or where the interpretation is uncertain. Visually distinguished from known matches
   (e.g., section divider, different styling). Fuzzy matching and confidence scoring are
   owned by F77, not F44.

### Two Action Paths for Unrecognized Input

When input contains tokens that don't match any vocabulary or master item:

1. **One-off quick-add** — add the raw input string directly to the shopping list without
   defining any vocabulary. Must be as fast as today's quick-add — one tap, no modals.
   This is the escape hatch for speed over structure.

2. **Clarify / define** — opens a separate modal where the user can:
   - Assign roles to unrecognized tokens (package, product name, size, etc.)
   - Choose what to save to master tables (add as new package type, add as new product,
     both, neither)
   - Preview the structured interpretation before confirming

   This follows the existing pattern where products can be one-off or added to the master
   list — extended to all entity types.

### Interaction Tiers by Input Quality

| Tier | Input quality | User interaction | Example |
|------|--------------|------------------|---------|
| **Exact** | All tokens match vocabulary + master item | Tap to add (same as today) | `2 cans chicken broth` |
| **Alias/plural** | Tokens match via vocabulary aliases | Silent normalization, tap to add | `2 bottles olive oil` → bottle |
| **Fuzzy match** | Close match via edit distance (F77) | Shown in "suggested" section of dropdown | `2 botles` → bottle? |
| **Unknown + structural signal** | Unrecognized token in a recognizable position | Clarify/define modal available | `2 sleeves crackers` → sleeve as package? |
| **Unknown, no signal** | Unrecognized tokens, no structural pattern | One-off add; clarify/define available | `2 thingamajigs rice` |

### Vocabulary Conflict Prevention

When a user defines a new vocabulary entry (e.g., adds "chicken" as a package type), the
system should warn if the new entry conflicts with existing data:
- *"'chicken' appears in N of your product names. Adding it as a package type may change
  how those items are parsed."*

The user can proceed (they own their vocabulary) but the warning helps avoid obvious
mistakes. The system does not block the addition.

---

## Scope Boundaries by Feature

| Feature | Owns |
|---------|------|
| **F44** | Parser architecture (passes 1-6), vocabulary table structure, token classification rules, single-interpretation output |
| **F77** | Fuzzy matching, confidence scoring, multi-candidate presentation in dropdown, typo tolerance |
| **F78** | Duplicate detection, merge strategies (additive math vs. string manipulation), operates on structured quantity fields |
| **F79** | Structured quantity storage migration, all vocabulary table management (units + packages + size descriptors), vocabulary management settings screen, household-scoped vocabulary CRUD |
| **F83** | Clarify/define modal, on-the-fly vocabulary definition flow during item add, vocabulary conflict prevention warnings, one-off add affordance |

### Recommended Implementation Order

```
F44 → F79 → F77 / F83 → F78 / F76
```

| Phase | Features | Why this order |
|-------|----------|----------------|
| 1 | **F44** | Establishes the parser, vocabulary table schema/seed data, and pluggable lookup interface. Foundation for everything else. |
| 2 | **F79** | Wires up structured quantity storage and household-extensible vocabulary CRUD. Needed before users can add vocabulary entries (F83) or features can operate on structured fields (F78, F76). |
| 3 | **F77 / F83** (parallel) | F77 extends matching via the pluggable interface F44 provides. F83 builds the definition flow on top of F79's vocabulary tables. Independent of each other. |
| 4 | **F78 / F76** (parallel) | Both operate on structured quantity fields from F79. F78 (duplicate merge) and F76 (recipe scaling) are independent of each other. |

**Note:** Each feature can be implemented and shipped incrementally. F44 works with the
current text schema (interim state). F77 and F83 add value independently. The order
reflects dependencies, not a requirement to batch them.

---

## Open Items

1. **Clarify/define modal design** — conceptually defined (assign roles to tokens, choose
   what to save, preview result) but UI layout not yet designed. Owned by **F83**.
   Consider whether this is a new mode of the existing edit-before-add modal or a
   separate modal.

2. **Vocabulary conflict checking rules** — warn on obvious conflicts (token appears in
   existing product names). Exact rules and severity thresholds not yet defined. Owned by **F83**.

3. **Dropdown visual design for two-category results** — section dividers, styling for
   suggested vs. known matches. Owned by **F77**.

4. **One-off add affordance** — must be prominent and zero-friction. Exact placement
   (always-visible button vs. dropdown row vs. both) not yet decided. Owned by **F83**.

---

## Revision History
- 2026-03-31: Initial draft — established from F44 design conversation covering quantity
  storage, vocabulary extensibility, and input interpretation model. Corrected storage
  decision to structured (not text). Assigned all open items to features: F79 (expanded
  to cover all vocabulary management + structured migration), F77 (two-category dropdown),
  F83 (new — vocabulary definition flow + conflict prevention)
