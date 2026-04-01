# Design: Free-form Input Parsing
<!-- ID: F44 | Status: DRAFT — Design in progress, not ready for spec -->
<!-- Renumbered from F14 / #44 — feature number now matches GitHub issue number -->

> **DRAFT — INCOMPLETE**
> This document is being written during an active design conversation.
> Sections marked `[OPEN]` have unresolved decisions.
> Do not hand off to `/spec` until all Open Questions are resolved and this notice is removed.
>
> **Parent architecture doc:** [Vocabulary, Quantity, and Input Interpretation](vocabulary-and-quantity-architecture.md)
> — covers cross-cutting decisions (storage format, vocabulary extensibility, interaction
> model) that span F44, F77, F78, and F79.

---

## Overview

Parses free-form text typed into the SmartAddItem input field to extract structured fields:
item name, count, package type, size, and store hint. Extracted values pre-fill the add flow
(qty field, store dropdown, pill bar pre-selection) so users can type naturally rather than
navigating multiple fields manually.

Split out from F12 (Smart Entry Model) to keep scope focused.

**Integration point:** `SmartAddItem.tsx` input layer. The parsed `name` drives
`useSearchItems()`; other parsed fields pre-populate form state.

---

## User Scenarios

- User types "2 milk" → qty=2 pre-filled, search finds "Milk"
- User types "milk @safeway" → store pre-set to Safeway, search finds "Milk"
- User types "1.5 lb chicken @costco" → qty=1.5 lb pre-filled, store=Costco, search finds "Chicken"
- User types "2x 8oz cans chicken broth" → count=2, size=8oz, package=can, search finds "Chicken Broth"
- User types "large avocado" → if "Large Avocado" is a master item, finds it directly; otherwise finds "Avocado" with size=large pre-filled

---

## Core Approach

**Programmatic and deterministic.** Rule-based tokenization + table lookups +
priority-ordered matching. No ML, no probability scoring, no fuzzy inference.
Every decision is a pattern match or a table lookup.

---

## Item Structure Model

Before defining parsing rules, it helps to state what a grocery list item actually *is*.
The parser's output fields — and the vocabulary tables that drive classification — are
derived directly from this model.

A grocery item can be understood as:

```
[count] [package] of [size] [product]
```

| Role | What it means |
|------|--------------|
| **Count** | How many packages or units to buy. Defaults to 1 (implied) when absent. |
| **Package** | The container or sales unit: can, bottle, box, bunch, etc. May be absent for produce and weight-sold items. |
| **Size** | Describes the package or item. Two forms: *quantitative* (a number + unit: `16oz`, `1.5 lb`) or *descriptive* (a qualitative word: `large`, `jumbo`). |
| **Product** | The item name — what the thing actually is. |

**Examples:**

| As typed | count | package | size | product |
|----------|-------|---------|------|---------|
| 1 can soup | 1 | can | — | soup |
| 2 16oz bottles olive oil | 2 | bottle | 16 oz | olive oil |
| 32oz box chicken broth | 1 (implied) | box | 32 oz | chicken broth |
| 1.5 lb chicken | — | — | 1.5 lb | chicken |
| large avocado | 1 (implied) | — | large | avocado |
| 1 bunch cilantro | 1 | bunch | — | cilantro |

**Key observations:**

- Count and package are independent: `2 cans soup` has count=2; `2 32oz cans soup` adds size.
- Size and package are also independent: `large avocado` has descriptive size but no package;
  `32oz box` has both.
- For weight-sold items (`1.5 lb chicken`), there is no discrete package — the quantitative size
  *is* the purchase unit.
- Implied count (1) is the default when no count token is present; it need not be stored explicitly.

**Model → vocabulary tables:** This structure explains why three separate lookup tables are needed:
- Units table → recognizes quantitative size units (`oz`, `lb`, `gal`, etc.)
- Packages table → recognizes package tokens (`can`, `bottle`, `bunch`, etc.)
- Size descriptors table → recognizes descriptive size words (`large`, `jumbo`, `small`, etc.)

**Identification principle — everything else is the product:** The parser identifies packages,
sizes, and stores by matching against known entity tables or sigil patterns. A word is classified
as a package only if it matches the packages table; a quantitative size only if it matches the
units table; a store hint only if it begins with `@`. Everything that doesn't match a known
pattern or table entry becomes part of the product description. The product name is discovered
by subtraction — not by lookup.

This subtraction model also points toward future extensibility: once all non-product tokens are
identified and removed, the remaining tokens form a "bag of product words." While V1 uses those
words only as a literal name string (exact match against master items), future passes could
support individual-word matching or any-order lookup — e.g., `chicken breast` and `breast chicken`
finding the same item. This is out of scope for V1 but is a natural consequence of the architecture.

---

## Parsing Architecture: Multi-Pass

### Overview

Six sequential passes transform raw input text into a structured `ParsedInput` object.
Each pass is independently testable. Later passes build on earlier ones — no backtracking.

| Pass | Name | Goal |
|------|------|------|
| 1 | **Tokenize** | Split input on whitespace; quoted strings become single tokens |
| 2 | **Per-Token Classification** | Classify each token by pattern match or table lookup; unrecognized tokens become NAME |
| 3 | **Adjacent Token Grouping** | Merge adjacent tokens into semantic groups (e.g., NUMBER + UNIT → QUANTITATIVE_SIZE) |
| 4 | **Candidate Assembly** | Extract each semantic role (count, package, size, store, name words) from the grouped token stream |
| 5 | **Name Resolution** | Look up candidate name strings against master items; first match wins |
| 6 | **Output** | Produce the structured `ParsedInput` object |

Passes 1–4 are purely structural — they classify tokens by form and table membership,
then assign roles by grammar rules. No app data is consulted until Pass 5.

---

### Pass 1 — Tokenize
Split input string on whitespace. Output: ordered list of raw string tokens.

```
"2 8oz cans chicken broth @safeway"
→ ["2", "8oz", "cans", "chicken", "broth", "@safeway"]
```

**Quoted strings:** Any content wrapped in double quotes (`"..."`) or single quotes (`'...'`)
is treated as a single token, regardless of spaces. The quotes are stripped; the content
becomes a single `NAME` token that bypasses Pass 2 classification entirely.

```
'5 hour energy' drink
→ ["5 hour energy", "drink"]   ← first token is single NAME, not split
```

This is an escape hatch for product names that would otherwise be mis-parsed. It is less
ergonomic than unquoted typing but gives users a reliable override when needed.

```
"2 'large pizza' @dominos"
→ ["2", "large pizza", "@dominos"]   ← "large" stays with "pizza", not parsed as SIZE_DESCRIPTIVE
```

---

### Pass 2 — Per-Token Classification

Classify each token by pattern match or table lookup:

| Token Type | Detection Method | Examples |
|------------|-----------------|---------|
| `COUNT_SIGIL` | Pattern: `^\d+x$` | `2x`, `3x` |
| `STORE_HINT` | Pattern: `^@\w+$` | `@safeway`, `@costco`, `@co` |
| `NUMBER` | Pattern: `^\d+(\.\d+)?$` | `2`, `1.5`, `32` |
| `COMPOUND` | Pattern: number fused with recognized unit (no space) | `8oz`, `1.5lb`, `32oz` |
| `UNIT` | Lookup: units table (canonical + aliases) | `oz`, `lb`, `gal`, `ct` |
| `PACKAGE` | Lookup: packages table + `\d+-pack` pattern | `cans`, `bottles`, `bunch`, `6-pack` |
| `SIZE_DESCRIPTIVE` | Lookup: size descriptors table | `large`, `jumbo`, `small` |
| `NAME` | Everything else | `chicken`, `broth`, `avocado` |

A token is classified as `COMPOUND` when it matches `^\d+(\.\d+)?[unit_alias]$` — i.e.,
a number immediately followed by a recognized unit abbreviation with no space.

---

### Pass 3 — Adjacent Token Grouping

Merges adjacent tokens into semantic groups. Because some groups depend on the output of
earlier merges (e.g., SIZED_PACKAGE requires a QUANTITATIVE_SIZE, which itself requires
a prior NUMBER+UNIT merge), this pass runs as **four ordered sub-passes** — each one
operating on the already-merged output of the previous. A single left-to-right scan cannot
handle multi-level merging reliably.

#### Sub-pass 3a — Normalize compound and spaced size tokens → QUANTITATIVE_SIZE

| Pattern | Result | Example |
|---------|--------|---------|
| `COMPOUND` alone | `QUANTITATIVE_SIZE` | `8oz` → `{qty: 8, unit: oz}` |
| `NUMBER + UNIT` | `QUANTITATIVE_SIZE` | `8` + `oz` → `{qty: 8, unit: oz}` |

After 3a, both `8oz` (fused) and `8 oz` (spaced) produce the same `QUANTITATIVE_SIZE` token.
This is the step that makes fused and spaced forms equivalent for all downstream processing.

#### Sub-pass 3b — Combine size with package → SIZED_PACKAGE

| Pattern | Result | Example |
|---------|--------|---------|
| `QUANTITATIVE_SIZE + PACKAGE` | `SIZED_PACKAGE` | `{qty:8, unit:oz}` + `cans` → `{size:{8,oz}, pkg:can}` |

Operates on QUANTITATIVE_SIZE tokens produced by 3a — not on raw NUMBER/UNIT tokens.

#### Sub-pass 3c — Attach count to package group → COUNT + SIZED_PACKAGE or COUNT + PACKAGE

| Pattern | Result | Example |
|---------|--------|---------|
| `NUMBER + SIZED_PACKAGE` | `COUNT` + `SIZED_PACKAGE` | `2` + `{size:{8,oz}, pkg:can}` → count=2 + sized_pkg |
| `NUMBER + PACKAGE` | `COUNT` + `PACKAGE` | `2` + `loaves` → count=2, pkg=loaf |
| `COUNT_SIGIL + SIZED_PACKAGE` | `COUNT(explicit)` + `SIZED_PACKAGE` | `2x` + `{size:{8,oz}, pkg:can}` |

#### Sub-pass 3d — Normalize pack patterns

| Pattern | Result | Example |
|---------|--------|---------|
| `\d+-pack` token | `PACKAGE` with embedded multiplier | `6-pack` → pkg=pack, embedded_count=6 |

---

**Worked trace — `"2 8 oz cans chicken broth"`:**

After Pass 2: `[NUMBER(2), NUMBER(8), UNIT(oz), PACKAGE(cans), NAME(chicken), NAME(broth)]`

3a: `NUMBER(8) + UNIT(oz)` → `QUANTITATIVE_SIZE(8,oz)`
→ `[NUMBER(2), QUANTITATIVE_SIZE(8,oz), PACKAGE(cans), NAME(chicken), NAME(broth)]`

3b: `QUANTITATIVE_SIZE(8,oz) + PACKAGE(cans)` → `SIZED_PACKAGE({8,oz}, can)`
→ `[NUMBER(2), SIZED_PACKAGE({8,oz}, can), NAME(chicken), NAME(broth)]`

3c: `NUMBER(2) + SIZED_PACKAGE` → `COUNT(2) + SIZED_PACKAGE`
→ `[COUNT(2), SIZED_PACKAGE({8,oz}, can), NAME(chicken), NAME(broth)]`

Same input with `8oz` fused (`"2 8oz cans chicken broth"`):
After Pass 2: `[NUMBER(2), COMPOUND(8oz), PACKAGE(cans), NAME(chicken), NAME(broth)]`
3a: `COMPOUND(8oz)` → `QUANTITATIVE_SIZE(8,oz)` — identical to above from this point.

Key result: `"2 8oz cans"` and `"2 8 oz cans"` produce identical output because
the fused/spaced difference is erased in 3a before any downstream sub-pass runs.

**Implementation strategy: iterative sub-passes.** The four sub-passes above are run
repeatedly in a loop until the token stream is unchanged after a full cycle (stabilization).
This handles arbitrary combination depth without the fragility of a fixed sub-pass count.

**Failsafe:** the loop must not run unboundedly. Maximum iterations = **10**. If the stream
has not stabilized after 10 cycles, the parser emits the best partial result accumulated so
far and treats remaining ungrouped tokens as NAME tokens. In practice, V1's grammar
stabilizes in at most 4 iterations (3 productive merges + 1 confirming no change); the
10-cycle limit is a safety net against future grammar additions or malformed input — not an
expected operating condition. The failsafe tripping should be treated as a bug to investigate,
not a normal fallback path.

**Warning log:** if the iteration count exceeds 4 at any point, emit a `console.warn()`
including the iteration count and the input string. This fires before the failsafe limit —
it's an early signal that the grammar has grown beyond the expected V1 depth, not a hard
failure. The app currently has no logging infrastructure beyond bare `console.error()` /
`console.warn()` calls; use `console.warn()` for consistency. If a structured logger is
added to the app in the future, this warning should be migrated to it.

---

### Pass 4 — Candidate Assembly

Extract each semantic role from the groups:

| Role | Source (priority order) |
|------|------------------------|
| `count` | COUNT_SIGIL value (explicit) › NUMBER before PACKAGE (inferred) › bare NUMBER with no PACKAGE |
| `packageType` | PACKAGE token canonical form |
| `sizeQty` + `sizeUnit` | QUANTITATIVE_SIZE group |
| `sizeDescriptive` | SIZE_DESCRIPTIVE token |
| `storeHint` | STORE_HINT token (@ stripped) |
| `name_words` | All remaining NAME tokens, original order |

---

### Pass 5 — Name Resolution via Master Items Lookup `[OPEN]`

Generate candidate name strings from `name_words` combined with size/descriptor tokens,
then check each against the master items table. First match wins.

**Example — `"large avocado"`:**
```
Tokens after Pass 4: SIZE_DESCRIPTIVE(large), NAME(avocado)

Candidates (in precedence order — ORDER NOT YET FINALIZED):
  1. "large avocado"   ← size_descriptive + name_words
  2. "avocado"         ← name_words only

Lookup results:
  "large avocado" exists in master items → name="large avocado", sizeDescriptive=null
  "avocado" exists, "large avocado" does not → name="avocado", sizeDescriptive="large"
  Neither exists → name="avocado" (new item candidate), sizeDescriptive="large"
```

**Matching strategy — Tier 1 bag-of-words (word-order independent, full token set):**
Name tokens from Pass 4 are treated as an unordered set. A master item matches when its
name token set equals the input name token set — same words, any order. "breast chicken"
finds "Chicken Breast" because both have the same two tokens.

This replaces exact-order string matching. It is still a full/exact match — every input
token must be present in the item name and vice versa. Partial/subset matching (input tokens
⊂ item name tokens) is **out of scope for F44** and handled by F77.

Matching is case-insensitive. No fuzzy matching, no typo tolerance, no plural normalization —
those are all F77 capabilities. The lookup is against the master items table via the same
pluggable lookup interface used by `useSearchItems()`, so F77 can extend it without
restructuring the parser.

> **[OPEN]** Precedence rules for candidate ordering not yet finalized.
> Proposed direction: most-specific (longest token set) match wins.
> When multiple candidates tie on specificity, first match wins.

---

### Pass 6 — Output

```typescript
interface ParsedInput {
  name: string                   // drives useSearchItems()
  count: number | null           // how many packages/units to buy
  packageType: string | null     // canonical package name: "can", "bottle", "bunch"
  sizeDescriptive: string | null // qualitative size: "large", "jumbo"
  sizeQty: number | null         // quantitative size value: 8, 1.5, 32
  sizeUnit: string | null        // quantitative size unit: "oz", "lb"
  storeHint: string | null       // store prefix hint: "safeway", "co"
}
```

---

## Explicit Sigils and Quoting

| Convention | Form | Meaning |
|------------|------|---------|
| `@` | `@word` | Store hint — next word is a prefix matched against the household's `stores` table |
| `x` | `Nx` | Explicit count — resolves count-vs-size ambiguity without inference |
| Quotes | `"..."` or `'...'` | Forces enclosed text into a single NAME token; bypasses classification |

`2x` is typed as a fused token (no space). "I want 2 of these" is unambiguous with the sigil;
without it, a bare `2` is inferred as count by rule.

`@` sigil: single-word only. `@safeway` matches; `@harris teeter` — only `harris` is the hint,
`teeter` becomes a NAME token. Prefix match against the actual `stores` table (case-insensitive).

**Quoting:** Wrapping words in quotes creates one NAME token and skips all classification.
This is the user-facing escape hatch for product names that contain numbers, size words,
or other terms that would otherwise be mis-classified. Less ergonomic than natural typing,
but predictable and reliable.

| Without quotes | With quotes |
|----------------|-------------|
| `5 hour energy` → count=5, name="hour energy" | `'5 hour energy'` → name="5 hour energy" |
| `2 step cleaner` → count=2, name="step cleaner" | `'2 step cleaner'` → name="2 step cleaner" |
| `large format paper` → size=large, name="format paper" | `'large format paper'` → name="large format paper" |

> **[OPEN]** Store prefix ambiguity: if `@co` prefix-matches multiple stores ("Costco", "Country
> Market"), disambiguation rule not yet designed.

---

## Vocabulary Tables

Three tables provide the recognized vocabulary for token classification:

### Units Table (exists, currently unused)
Quantitative size units. Any NUMBER + recognized UNIT is a valid quantitative size —
the number is free-range; no need to enumerate `32oz` as a specific entry.

Must include aliases so `oz`, `ounce`, `ounces` all resolve to the same canonical unit.

**Seed values:**
- Weight: oz/ounce/ounces, lb/lbs/pound/pounds, g/gram/grams, kg/kilogram/kilograms
- Volume: gal/gallon/gallons, qt/quart/quarts, pt/pint/pints, ml/milliliter, L/liter/liters, cup/cups
- Other: ct/count, fl oz/fluid ounce, ft/foot/feet

### Packages Table (new)
Container and sales-unit words. These describe *what holds or groups the product*,
distinct from measurement units.

**Seed values (canonical → aliases):**
can/cans, bottle/bottles, jar/jars, box/boxes, bag/bags, carton/cartons, tub/tubs,
container/containers, tube/tubes, roll/rolls, stick/sticks, bar/bars, block/blocks,
wheel/wheels, loaf/loaves, sheet/sheets, pouch/pouches, sleeve/sleeves, pack/packs,
package/packages/pkg, case/cases, flat/flats, tray/trays, rack/racks, bunch/bunches,
head/heads, ear/ears, stalk/stalks, sprig/sprigs, clove/cloves, fillet/fillets,
slice/slices, patty/patties, link/links, dozen, pair/pairs, tablet/tablets, capsule/capsules

**Pattern entry:** `\d+-pack` — matches `4-pack`, `6-pack`, `12-pack`, `24-pack`, etc.
without enumerating every variant. Encodes an embedded multiplier.

**Intentionally excluded** (handled by master items lookup instead):
Portion/body-part words (breast, chop, cutlet, thigh, wing) — these are commonly part of
item names. Excluding them from the packages table prevents `"chicken breasts"` from
parsing as `packageType=breast, name=chicken`.

### Size Descriptors Table (new)
Qualitative physical size words — describe *how big*, not *what kind*.

**Seed values:** large, medium, small, xl/extra-large, jumbo, mini/miniature, petite,
king-size, family-size, travel-size, regular

**Intentionally excluded** (these stay in item name):
- Product variants: condensed, skim, whole, 2%, non-fat, diet, zero, low-fat
- Preparation style: thin-sliced, thick-cut, shredded, diced, crushed, boneless, skinless
- Product attributes: organic, fresh, frozen, raw, cooked

**Test for inclusion:** does this word describe physical size/dimension? → include.
Does it describe the nature, variant, or preparation of the product? → exclude, stays in name.

---

## Interaction with Preferred Quantities (alternate_qtys)

Preferred quantities are **master-item-specific**, not global. Stored today as a list of
free-form strings in `items.alternate_qtys` (e.g., `["1.5 lb", "2 lb", "large"]`).

**Architectural target:** `alternate_qtys` will move to structured entries under F79,
consistent with the structured quantity storage decision (see
[Vocabulary and Quantity Architecture](vocabulary-and-quantity-architecture.md) § Quantity Storage).

**Interim consistency requirement:** while `alternate_qtys` remains TEXT[], every string
must be parseable using the vocabulary tables above. If a string can't be parsed back to
a QUANTITATIVE_SIZE or SIZE_DESCRIPTIVE token, the tables have a gap that must be filled.

**At spec time:** audit all existing `alternate_qtys` values; seed tables to cover any
vocabulary gaps found.

**Pill pre-selection:** when parsed size matches an `alternate_qtys` entry (after
normalization — `"1.5lb"` and `"1.5 lb"` treated as equivalent), that pill is
pre-selected in the add flow. Under structured storage, this comparison becomes exact
field matching with no normalization needed.

---

## Worked Examples

| Input | count | package | size | store | name |
|-------|-------|---------|------|-------|------|
| `2 milk` | 2 | — | — | — | milk |
| `milk @safeway` | — | — | — | safeway | milk |
| `milk 2` | 2 | — | — | — | milk |
| `1.5 lb chicken @costco` | — | — | 1.5 lb | costco | chicken |
| `2x milk` | 2 (explicit) | — | — | — | milk |
| `2 8oz cans chicken broth` | 2 | can | 8 oz | — | chicken broth |
| `2 8 oz cans chicken broth` | 2 | can | 8 oz | — | chicken broth (same result) |
| `2x 8oz cans chicken broth @safeway` | 2 (explicit) | can | 8 oz | safeway | chicken broth |
| `2 packages 1.2 lb chicken breast` | 2 | package | 1.2 lb | — | chicken breast |
| `large avocado` | — | — | large* | — | avocado* |
| `2 loaves bread` | 2 | loaf | — | — | bread |
| `1 bunch cilantro` | 1 | bunch | — | — | cilantro |
| `3 12-pack Coke` | 3 | 12-pack | — | — | Coke |

*Result of `"large avocado"` depends on master items lookup (Pass 5) — see that section.

---

## Known Limitations (Documented — Not Bugs)

| Input | What the parser does | Why acceptable |
|-------|---------------------|----------------|
| `5 hour energy` | count=5, name="hour energy" | Use `'5 hour energy'` to force single token |
| `2 step cleaner` | count=2, name="step cleaner" | Use `'2 step cleaner'` to force single token |
| `@harris teeter` | hint="harris", "teeter" → NAME | Single-word @hint; `@har` works fine |
| `half lb turkey` | no qty parsed | Fractions not supported V1 |
| `a dozen eggs` | name="a dozen eggs" | Word-quantities not supported V1 |
| `2 packages ground beef` | count=2, size=null | Variable-weight items; size unknown at list time |

---

## Open Questions

> These must be resolved before handing off to `/spec`.

1. **Precedence rules (Pass 5):** Candidate ordering for name resolution not finalized.
   Proposed: most-specific (longest) match wins. Needs explicit rule list.

2. ~~**Data model — qty field when both count AND size parse** — Resolved. See Design Decisions (quantity storage format).~~

3. ~~**alternate_qtys structure** — Resolved. See Design Decisions.~~

4. **UI decisions (entire Pass 2 of design conversation — not yet started):**
   - Does the user see real-time feedback showing what was parsed?
   - How does parsed context appear in the dropdown / search results?
   - If parsing produces a store hint, is the store field locked or just pre-populated?
   - Where does parse error/fallback state surface (if at all)?

5. **Store prefix ambiguity:** If `@co` matches multiple stores, what happens?
   Disambiguation rule not yet designed.

6. ~~**Pass 3 implementation strategy** — Resolved. See Design Decisions.~~

---

## Out of Scope (V1)

- Fractions (`1/2 lb`, `1/4 lb`) — not supported; use decimal (`0.5 lb`)
- Word-quantities (`a dozen`, `half a pound`) — not supported
- Multi-word store hints (`@harris teeter`) — single-word only
- Qualitative product descriptors (`condensed`, `skim`, `organic`) — stay in item name, not parsed
- AI/NLP-based interpretation — this is intentionally programmatic only
- **Deferred to F77 (Fuzzy Matching in Smart Add):**
  - Subset/partial matching — input tokens ⊂ item name tokens (e.g., "boneless skinless" matching "Chicken Breasts Boneless Skinless")
  - Typo tolerance / edit-distance matching
  - Plural normalization / stemming ("breasts" → "breast")
  - Item aliases — product-level, household-defined alternate search strings
  - Pass 5 uses a pluggable lookup interface so F77 can extend matching without restructuring the parser

---

## Design Decisions

### Parsing approach
**Decision:** Programmatic, deterministic, rule-based. Not AI/ML-driven.
**Rationale:** Predictable behavior, testable, no runtime inference cost, no ambiguity
about what the app will do with any given input.

### Multi-pass architecture
**Decision:** Six passes: tokenize → classify → group → assemble → lookup → output.
**Rationale:** Each pass is independently testable. Grouping (Pass 3) cleanly handles
the spaced vs. fused variant problem (`8 oz` vs. `8oz`). Lookup (Pass 5) keeps name
resolution separate from structural parsing.

### Count sigil (`Nx`)
**Decision:** `2x` as a fused token explicitly marks count.
**Rationale:** Resolves count-vs-size ambiguity without inference. Natural notation
(users already write this on paper lists). Consistent with existing `@` sigil pattern.

### Quantitative size: free number + table unit
**Decision:** Any NUMBER + recognized UNIT is a valid quantitative size. Units table
provides the recognized vocabulary; the number is free-range.
**Rationale:** Don't enumerate `3oz`, `5oz`, `8oz`, `32oz` — just recognize `oz`.
Preferred quantities (specific values like `1.5 lb`) are item-specific via `alternate_qtys`.

### Three vocabulary tables
**Decision:** Units (existing), Packages (new), Size Descriptors (new) as separate tables.
**Rationale:** Each represents a distinct semantic category. Mixing them would complicate
token classification and make the tables harder to maintain.

### Packages vs. size descriptors vs. product attributes
**Decision:** Packages = container/sales-unit words. Size descriptors = physical dimension
words. Product attributes (condensed, organic, skim) stay in item name.
**Rationale:** Keeps the item name as the source of truth for product identity.
The test: "does this word describe size?" vs. "does it describe what the product is?"

### Preferred quantities are item-specific
**Decision:** `alternate_qtys` on master items, not a global preferred-sizes list.
**Rationale:** A "large" is only meaningful for items where that size exists; `1.5 lb`
is only relevant for items sold by weight. Global lists would be noise.

### Quantity storage format: structured (architectural decision)
**Decision:** The long-term architecture calls for structured quantity storage. The parser
is the normalization layer — its structured output is what gets stored, not a serialized
text string. Multiple downstream consumers (F78 merge, F76 recipe scaling, warnings, pill
pre-selection, edit modal) need structure; only display needs a rendered string.
**F44 interim:** Until F79 implements the schema change, F44 may store quantity as serialized
text. This is transitional — F44's parser output and internal representations should be
structure-ready. `alternate_qtys` (TEXT[]) also follows this pattern: strings for now,
structured under F79.
**Full rationale:** See [Vocabulary and Quantity Architecture](vocabulary-and-quantity-architecture.md) § Quantity Storage.

### Pass 3 grouping strategy: iterative sub-passes
**Decision:** Pass 3 runs as four ordered sub-passes (3a–3d) in a loop until the token
stream stabilizes. Two thresholds govern loop behavior:
- **Warning at >4 iterations:** emit `console.warn()` with iteration count and input string — early signal that grammar has grown beyond expected V1 depth
- **Failsafe at 10 iterations:** abort loop, emit best partial result, treat ungrouped tokens as NAME

The app has no logging infrastructure beyond bare `console.warn()` / `console.error()`;
use `console.warn()` for consistency until a structured logger exists.

**Rationale:** Iterative sub-passes combine the testability of a fixed sub-pass sequence
(each sub-pass can be tested in isolation) with the depth safety of a shift-reduce
approach (no hard bound on combination depth). For V1's grammar the loop stabilizes in
at most 4 iterations; both thresholds are safety nets, not designed operating conditions.
The failsafe tripping is a bug indicator — investigate, don't normalize it.
**Alternatives considered:**
- Fixed sub-passes (run once): simpler, but bounded by sub-pass count — fragile as grammar grows
- Shift-reduce single pass: handles arbitrary depth but harder to test and debug in isolation

---

## Revision History
- 2026-03-27: Initial draft — design conversation in progress, not complete
- 2026-03-28: Added Item Structure Model section — conceptual foundation for the parsing rules; added identification-by-subtraction principle + bag-of-words future note; added architecture overview table; added quoted-string token support; updated Known Limitations to reflect quoting escape hatch; expanded Pass 3 into four ordered sub-passes with worked trace to make multi-level merging explicit
- 2026-03-29: Resolved Open Q#6 — iterative sub-passes with max-10 failsafe; added Pass 3 strategy to Design Decisions
- 2026-03-30: Pass 5 matching resolved to Tier 1 bag-of-words (full token set, word-order independent); subset matching/typos/plurals/aliases explicitly deferred to F77; alternate_qtys initially resolved to TEXT[] strings (superseded — see 2026-03-31)
- 2026-03-31: Resolved Open Q#2 (quantity storage) — structured storage is the architectural target; F44 interim may use text strings until F79 implements schema change; created parent architecture doc (vocabulary-and-quantity-architecture.md) covering cross-cutting storage, vocabulary extensibility, and input interpretation model
