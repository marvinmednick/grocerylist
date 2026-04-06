# Architecture: Vocabulary, Quantity, and Input Interpretation

<!-- Status: DRAFT — Established 2026-03-31, active design conversation -->

> Cross-cutting architectural document. Covers the philosophy and long-term model for how
> the app handles vocabulary (units, packages, size descriptors), quantity storage and
> display, and user interaction when input doesn't match known entities.
>
> **Related features:** F44 (free-form parsing), F79 (quantity units system), F85
> (structured quantity conversion), F90 (token & item aliases), F77 (fuzzy matching),
> F78 (duplicate handling), F83 (vocabulary definition flow)

---

## Core Philosophy

The app maintains **vocabulary tables** (units, packages, size descriptors) and a
**master items dictionary** that together define the recognized entities in the system.
User input is parsed against these tables to extract structured meaning. When input
doesn't match known vocabulary, the user is presented with options to clarify — following
the same pattern used for products today (match existing or add new).

**Key principles:**

1. **Every inference is visible and overridable.** The system never acts on a silent
   assumption. Parsed values are surfaced through pre-selected pills and ranked
   interpretations so the user can see what was inferred and change any of it before
   committing. But explicit confirmation of each field is not required — tapping the
   item name commits all pre-selected values.
2. **One-off is always frictionless.** Adding a raw string to the shopping list (without
   defining vocabulary or master items) must be as fast as it is today — one tap.
3. **Defining new vocabulary is deliberate.** Adding to master tables (products, packages,
   units) goes through a separate UI flow, not inline in the dropdown. This prevents
   accidental vocabulary pollution.
4. **Parse once, use everywhere.** The parser normalizes input at write time. Downstream
   consumers (display, merge, recipe scaling) work from the stored result, not by
   re-parsing strings.
5. **Rank, don't decide.** When multiple valid interpretations exist, present them all
   ranked by quality — don't silently pick a winner. The system's job is to order
   options by likelihood; the user's job is to choose. This extends principle #1: the
   user can see all alternatives, not just the top-ranked guess.
6. **Context sorts, never filters.** User input (typed text, parsed values) affects the
   *order* of presented options, not which options are *visible*. Valid choices are never
   hidden because they don't match the current input — the user may have mistyped or
   may want to change their mind. Show everything, put the most relevant options first.
7. **Extend existing surfaces before adding new ones.** When a new capability needs UI,
   first ask whether existing elements (pills, dropdown rows, modals) can carry the new
   information. Prefer enriching what's already there over introducing new UI concepts.
   New surfaces mean more to learn; extending existing ones keeps the interface familiar.

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

**Display model (settled in F85):** The `quantity` / `default_qty` / `alternate_qtys` TEXT
columns are the authoritative display values — all UI rendering reads them directly. At
write time, when `quantity_parsed` is non-null, the corresponding TEXT field is set to
`formatQuantity(quantity_parsed)` (normalized form). When `quantity_parsed` is null
(unparseable or one-off input), the TEXT field stores raw user text as-is. No
display-side code reads `quantity_parsed` directly — normalization happens once at write
time. This model is intentional and fixed; changes require a new spec.

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

- `list_items.quantity_parsed` (JSONB, added in F79, populated in F85) stores structured
  quantity. The `quantity` TEXT column is the display field — kept in sync at write time
  via `formatQuantity(quantity_parsed)` when parsed, raw text otherwise.
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
   and master items. Each match appears as a dropdown row with parsed context surfaced
   through pills: qty pills pre-selected from parsed value, store pills shown when
   `@hint` is present, orphan tokens (unmatched words) shown struck-through. Multiple
   interpretations of the same input may produce multiple rows (ranked by longest name
   match). See F44 design doc § Dropdown UI for full details.

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

## Architectural Dependencies

These are structural constraints — later capabilities depend on earlier ones being in place.

- **Vocabulary classification must precede alias expansion.** Pass 2 (token classification against vocabulary tables) runs before alias expansion. A token classified as PACKAGE or UNIT has structural meaning that aliases must not override. This is why "can" → "canned" as an alias won't fire when "can" appears in a quantity context.
- **Structured quantity storage must precede quantity math.** Duplicate merge (F78) and recipe scaling (F76) operate on structured fields. They require the `quantity_parsed` JSONB column and `formatQuantity` pipeline established by F79/F85.
- **Parser architecture is the integration point.** All matching improvements (aliases, fuzzy matching, plural normalization) plug into the F44 parser pipeline. Token alias expansion runs between Pass 4 and Pass 5. Item aliases are flattened into the Pass 5 name resolution loop. Fuzzy matching extends the same lookup interface.
- **Alias system is independent of fuzzy matching.** Token and item aliases (F90) work via exact lookup — no edit-distance computation. Fuzzy matching (F77) is a separate matching tier that can optionally apply to alias entries later.

---

## Open Design Questions

1. **Clarify/define modal design** — conceptually defined (assign roles to tokens, choose
   what to save, preview result) but UI layout not yet designed. Relevant to **F83**.

2. **Dropdown visual design for two-category results** — section dividers, styling for
   suggested vs. known matches. Relevant to **F77**.

---

## Revision History
- 2026-03-31: Initial draft — established from F44 design conversation covering quantity
  storage, vocabulary extensibility, and input interpretation model. Corrected storage
  decision to structured (not text).
- 2026-04-01: Updated to reflect F44 design completion — F44 scope expanded from single-
  interpretation to ranked multi-interpretation output; dropdown description updated with
  specific pill/orphan UI design. Added three core principles: #5 "rank, don't decide",
  #6 "context sorts, never filters", #7 "extend existing surfaces". Revised principle #1
  to "every inference is visible and overridable".
- 2026-04-05: Restructured — removed "Scope Boundaries by Feature" table and
  "Recommended Implementation Order" (project planning, not architecture; tracked in
  PLAN.md). Replaced with "Architectural Dependencies" section covering structural
  constraints between capabilities. Removed resolved open items (vocabulary conflict
  checking now designed in F90; one-off add affordance exists). Added F90 (token & item
  aliases) to related features.
