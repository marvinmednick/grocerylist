# Design: Free-form Input Parsing
<!-- ID: F14 | Status: DRAFT — Design in progress, not ready for spec -->

> **DRAFT — INCOMPLETE**
> This document is being written during an active design conversation.
> Sections marked `[OPEN]` have unresolved decisions.
> Do not hand off to `/spec` until all Open Questions are resolved and this notice is removed.

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

## Parsing Architecture: Multi-Pass

### Pass 1 — Tokenize
Split input string on whitespace. Output: ordered list of raw string tokens.

```
"2 8oz cans chicken broth @safeway"
→ ["2", "8oz", "cans", "chicken", "broth", "@safeway"]
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

Scan adjacent token pairs and triples to merge them into semantic groups:

| Pattern | Merged Into | Example |
|---------|------------|---------|
| `NUMBER + UNIT` | `QUANTITATIVE_SIZE` | `1.5` + `lb` → `{qty: 1.5, unit: lb}` |
| `COMPOUND` (alone) | `QUANTITATIVE_SIZE` | `8oz` → `{qty: 8, unit: oz}` |
| `QUANTITATIVE_SIZE + PACKAGE` | `SIZED_PACKAGE` | `8oz` + `cans` → `{size: {8,oz}, pkg: can}` |
| `NUMBER + QUANTITATIVE_SIZE + PACKAGE` | `COUNT + SIZED_PACKAGE` | `2` + `8oz` + `cans` |
| `NUMBER + NUMBER + UNIT + PACKAGE` | `COUNT + SIZED_PACKAGE` | `2 8 oz cans` (spaced) → same result as above |
| `\d+-pack` token | `PACKAGE` with embedded multiplier | `6-pack`, `12-pack`, `24-pack` |

Key result: `"2 8oz cans"` and `"2 8 oz cans"` produce identical grouped output.

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

Matching is exact, case-insensitive. No fuzzy matching.

> **[OPEN]** Precedence rules for candidate ordering not yet finalized.
> Proposed direction: most-specific (longest) match wins.
> Confirmed: exact match only, no fuzzy.

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

## Explicit Sigils

| Sigil | Form | Meaning |
|-------|------|---------|
| `@` | `@word` | Store hint — next word is a prefix matched against the household's `stores` table |
| `x` | `Nx` | Explicit count — resolves count-vs-size ambiguity without inference |

`2x` is typed as a fused token (no space). "I want 2 of these" is unambiguous with the sigil;
without it, a bare `2` is inferred as count by rule.

`@` sigil: single-word only. `@safeway` matches; `@harris teeter` — only `harris` is the hint,
`teeter` becomes a NAME token. Prefix match against the actual `stores` table (case-insensitive).

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

**Consistency requirement:** every `alternate_qtys` string must be parseable using the
vocabulary tables above. If a string can't be parsed back to a QUANTITATIVE_SIZE or
SIZE_DESCRIPTIVE token, the tables have a gap that must be filled.

**At spec time:** audit all existing `alternate_qtys` values; seed tables to cover any
vocabulary gaps found.

**Pill pre-selection:** when parsed size matches an `alternate_qtys` entry (after
normalization — `"1.5lb"` and `"1.5 lb"` treated as equivalent), that pill is
pre-selected in the add flow.

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
| `5 hour energy` | count=5, name="hour energy" | `5` is a valid NUMBER; user corrects in edit modal |
| `2 step cleaner` | count=2, name="step cleaner" | same pattern |
| `@harris teeter` | hint="harris", "teeter" → NAME | Single-word @hint; `@har` works fine |
| `half lb turkey` | no qty parsed | Fractions not supported V1 |
| `a dozen eggs` | name="a dozen eggs" | Word-quantities not supported V1 |
| `2 packages ground beef` | count=2, size=null | Variable-weight items; size unknown at list time |

---

## Open Questions

> These must be resolved before handing off to `/spec`.

1. **Precedence rules (Pass 5):** Candidate ordering for name resolution not finalized.
   Proposed: most-specific (longest) match wins. Needs explicit rule list.

2. **Data model — qty field when both count AND size parse:**
   e.g., `2 packages 1.2 lb chicken` → what goes in `list_items.qty`?
   Options: just count (`2`), just size (`1.2 lb`), concatenated (`2 packages 1.2 lb`),
   or surface both in edit modal and let user choose.

3. **alternate_qtys structure:** Keep as free-form strings with vocabulary validation,
   or add typed entries (structured `{qty, unit}` records)? Leaning toward strings + validation.

4. **UI decisions (entire Pass 2 of design conversation — not yet started):**
   - Does the user see real-time feedback showing what was parsed?
   - How does parsed context appear in the dropdown / search results?
   - If parsing produces a store hint, is the store field locked or just pre-populated?
   - Where does parse error/fallback state surface (if at all)?

5. **Store prefix ambiguity:** If `@co` matches multiple stores, what happens?
   Disambiguation rule not yet designed.

---

## Out of Scope (V1)

- Fractions (`1/2 lb`, `1/4 lb`) — not supported; use decimal (`0.5 lb`)
- Word-quantities (`a dozen`, `half a pound`) — not supported
- Multi-word store hints (`@harris teeter`) — single-word only
- Qualitative product descriptors (`condensed`, `skim`, `organic`) — stay in item name, not parsed
- AI/NLP-based interpretation — this is intentionally programmatic only

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

---

## Revision History
- 2026-03-27: Initial draft — design conversation in progress, not complete
