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
item name, count, package type, size, and store hint. Extracted values pre-populate the
dropdown result rows (qty pills pre-selected, store pills shown when `@hint` is present)
so users can type naturally rather than navigating multiple fields manually.

Split out from F12 (Smart Entry Model) to keep scope focused.

**Integration point:** `SmartAddItem.tsx` input layer. The parser produces a `ParseResult`
containing ranked interpretations; the top-ranked interpretation's `name` drives
`useSearchItems()`, and other parsed fields pre-populate pill state on each result row.

---

## User Scenarios

- User types "2 milk" → qty=2 pill pre-selected, search finds "Milk"
- User types "milk @safeway" → Safeway store pill shown and pre-selected, search finds "Milk"
- User types "1.5 lb chicken @costco" → qty=1.5lb pill pre-selected, Costco store pill shown, search finds "Chicken"
- User types "2x 8oz cans chicken broth" → count=2, size=8oz, package=can; search finds "Chicken Broth"
- User types "large avocado" → if both "Large Avocado" and "Avocado" are master items, dropdown shows both as ranked interpretations (Large Avocado first, Avocado with size=large second)
- User types "large green avocado" → "Large Avocado" shown with ~~green~~ struck-through; user can tap to add, edit input, or add as one-off

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
identified and removed, the remaining tokens form a "bag of product words." Pass 5 uses
bag-of-words matching (word-order independent) — `chicken breast` and `breast chicken` find
the same master item. Future extensions (F77) could add subset matching, typo tolerance, and
fuzzy search on top of this foundation.

---

## Parsing Architecture: Multi-Pass

### Overview

Six sequential passes transform raw input text into a `ParseResult` containing ranked
interpretations. Each pass is independently testable. Later passes build on earlier ones
— no backtracking.

| Pass | Name | Goal |
|------|------|------|
| 1 | **Tokenize** | Split input on whitespace; quoted strings become single tokens |
| 2 | **Per-Token Classification** | Classify each token by pattern match or table lookup; unrecognized tokens become NAME |
| 3 | **Adjacent Token Grouping** | Merge adjacent tokens into semantic groups (e.g., NUMBER + UNIT → QUANTITATIVE_SIZE) |
| 4 | **Candidate Assembly** | Extract each semantic role (count, package, size, store, name words) from the grouped token stream |
| 5 | **Name Resolution** | Look up candidate name strings against master items; return all valid interpretations ranked by quality |
| 6 | **Output** | Produce the `ParseResult` containing ranked `ParsedInput[]` + `rawInput` |

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
| `\d+-pack` token | `PACKAGE` (literal string) | `6-pack` → pkg="6-pack", `12-pack` → pkg="12-pack" |

The N-pack pattern is recognized as a PACKAGE token but kept as a literal string —
not decomposed into a multiplier and "pack". `packageType` stores the full string
(e.g., `"12-pack"`). If downstream features (F78 merge math, F76 recipe scaling) need
to extract the numeric multiplier, they can parse it from the string at that point.

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

### Pass 5 — Name Resolution via Master Items Lookup

Generate candidate name strings from `name_words` combined with dual-candidacy tokens
(size descriptors that could be part of the product name OR metadata), then check each
against the master items table. **All valid interpretations are returned**, ranked by
quality — not just a single winner.

**Matching strategy — Tier 1 bag-of-words (word-order independent, full token set):**
Name tokens from Pass 4 are treated as an unordered set. A master item matches when its
name token set equals the candidate name token set — same words, any order. "breast chicken"
finds "Chicken Breast" because both have the same two tokens.

This replaces exact-order string matching. It is still a full/exact match — every candidate
token must be present in the item name and vice versa. Partial/subset matching (input tokens
⊂ item name tokens) is **out of scope for F44** and handled by F77.

Matching is case-insensitive. No fuzzy matching, no typo tolerance, no plural normalization —
those are all F77 capabilities. The lookup is against the master items table via the same
pluggable lookup interface used by `useSearchItems()`, so F77 can extend it without
restructuring the parser.

**Candidate generation:** Pass 5 generates all subsets of `name_words` combined with
dual-candidacy tokens (currently just SIZE_DESCRIPTIVE). Each subset that matches a master
item produces a valid interpretation. Tokens not consumed by the name match are assigned
to their metadata role (e.g., SIZE_DESCRIPTIVE → `sizeDescriptive`) if applicable, or
become **orphans** if they have no role.

**Orphan tokens:** NAME tokens left over after a shorter match are not discarded — they
are carried in an `orphans[]` field on the interpretation. Orphans do not disqualify an
interpretation. This is important for free-form input where users may include words that
don't match their master items (e.g., `large green avocado` where "Large Avocado" exists
but "green" has no role).

**Ranking rule:** Interpretations are ranked by **longest name match** — more-specific
names rank first. In practice, longer matches also produce fewer orphans (consuming more
tokens into the name leaves fewer left over), so this single rule covers both concerns.

**Example — `"large avocado"` (both "Large Avocado" and "Avocado" exist):**
```
Tokens after Pass 4: SIZE_DESCRIPTIVE(large), NAME(avocado)

Candidates checked:
  "large avocado" (size_descriptive + name_words) → match "Large Avocado"
  "avocado" (name_words only) → match "Avocado"

Result — two interpretations, ranked:
  1. { name: "Large Avocado", sizeDescriptive: null, orphans: [] }     ← 2-token, 0 orphans
  2. { name: "Avocado",       sizeDescriptive: "large", orphans: [] }  ← 1-token, 0 orphans
```

**Example — `"large banana"` (only "Banana" exists):**
```
Candidates checked:
  "large banana" → no match
  "banana" → match "Banana"

Result — one interpretation:
  1. { name: "Banana", sizeDescriptive: "large", orphans: [] }
```

**Example — `"large green avocado"` ("Large Avocado" exists, no "Large Green Avocado"):**
```
Tokens after Pass 4: SIZE_DESCRIPTIVE(large), NAME(green), NAME(avocado)

Candidates checked:
  "large green avocado" → no match
  "large avocado" → match "Large Avocado"  (orphan: "green")
  "green avocado" → no match
  "avocado" → match "Avocado"  (orphan: "green", sizeDescriptive: "large")

Result — two interpretations, ranked:
  1. { name: "Large Avocado", sizeDescriptive: null, orphans: ["green"] }   ← 1 orphan, 2-token
  2. { name: "Avocado", sizeDescriptive: "large", orphans: ["green"] }      ← 1 orphan, 1-token
```

**Example — no master item matches at all:**
```
"purple yam" — neither "Purple Yam" nor "Yam" exist

Result — zero interpretations. rawInput available for one-off add.
```

**Dropdown display:** Orphan tokens are shown **struck-through** next to the matched item
name, giving the user immediate visual feedback about what wasn't matched. The user can:
- **Tap a match** — adds the matched item; orphans are silently dropped
- **Edit their input** — correct the text and re-parse
- **Add as one-off** — the full raw input string goes on the list with no master item link

---

### Pass 6 — Output

```typescript
interface ParsedInput {
  name: string                   // matched master item name (or candidate name if no match)
  count: number | null           // how many packages/units to buy
  packageType: string | null     // canonical package name: "can", "bottle", "bunch"
  sizeDescriptive: string | null // qualitative size: "large", "jumbo"
  sizeQty: number | null         // quantitative size value: 8, 1.5, 32
  sizeUnit: string | null        // quantitative size unit: "oz", "lb"
  storeHint: string | null       // store prefix hint: "safeway", "co"
  orphans: string[]              // unmatched NAME tokens — empty when clean
}

interface ParseResult {
  interpretations: ParsedInput[] // ranked: longest name match first
  rawInput: string               // original input text, for one-off add path
}
```

`ParseResult` is the top-level return value. `interpretations` may be empty if no master
item matches any candidate — the one-off add path uses `rawInput`. When only one
interpretation exists, the dropdown can auto-highlight it without requiring a choice.

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

Multiple prefix matches (e.g., `@co` matching "Costco" and "Country Market") are shown as
store pills in the dropdown — the user taps the right one or refines the hint. See
Dropdown UI § Store Pills.

---

## Vocabulary Tables

Three tables provide the recognized vocabulary for token classification:

### Units Table (exists, currently unused)
Quantitative size units. Any NUMBER + recognized UNIT is a valid quantitative size —
the number is free-range; no need to enumerate `32oz` as a specific entry.

Must include aliases so `oz`, `ounce`, `ounces` all resolve to the same canonical unit.
**All aliases must be single tokens** — the parser tokenizes on whitespace, so
multi-word aliases (e.g., `fl oz`, `fluid ounce`) cannot be recognized. Users can type
`floz` (fused) or just `oz`; in casual grocery use the distinction rarely matters.
Multi-token unit handling is out of scope for V1 and could be added as a Pass 2/3
extension later if needed.

**Seed values** (review at spec/implementation time):

| Canonical | Aliases | Category |
|-----------|---------|----------|
| oz | ounce, ounces | Weight |
| lb | lbs, pound, pounds | Weight |
| g | gram, grams | Weight |
| kg | kilogram, kilograms | Weight |
| gal | gallon, gallons | Volume |
| qt | quart, quarts | Volume |
| pt | pint, pints | Volume |
| ml | milliliter, milliliters | Volume |
| L | liter, liters | Volume |
| cup | cups | Volume |
| ct | count | Count |
| floz | — | Volume |

### Packages Table (new)
Container and sales-unit words. These describe *what holds or groups the product*,
distinct from measurement units.

**Seed values** (review at spec/implementation time):

| Canonical | Aliases | Category |
|-----------|---------|----------|
| can | cans | Container |
| bottle | bottles | Container |
| jar | jars | Container |
| box | boxes | Container |
| bag | bags | Container |
| carton | cartons | Container |
| tub | tubs | Container |
| container | containers | Container |
| tube | tubes | Container |
| pouch | pouches | Container |
| sleeve | sleeves | Container |
| roll | rolls | Unit |
| stick | sticks | Unit |
| bar | bars | Unit |
| block | blocks | Unit |
| loaf | loaves | Unit |
| sheet | sheets | Unit |
| pack | packs | Grouping |
| package | packages, pkg | Grouping |
| case | cases | Grouping |
| flat | flats | Grouping |
| tray | trays | Grouping |
| rack | racks | Grouping |
| dozen | — | Grouping |
| pair | pairs | Grouping |
| bunch | bunches | Produce |
| head | heads | Produce |
| ear | ears | Produce |
| stalk | stalks | Produce |
| sprig | sprigs | Produce |
| clove | cloves | Produce |
| fillet | fillets | Protein |
| slice | slices | Protein |
| patty | patties | Protein |
| link | links | Protein |
| tablet | tablets | Supplement |
| capsule | capsules | Supplement |

**Pattern entry:** `\d+-pack` — matches `4-pack`, `6-pack`, `12-pack`, `24-pack`, etc.
without enumerating every variant. Stored as a literal package string (e.g., `"12-pack"`),
not decomposed into a number and "pack".

**Intentionally excluded** (handled by master items lookup instead):
Portion/body-part words (breast, chop, cutlet, thigh, wing) — these are commonly part of
item names. Excluding them from the packages table prevents `"chicken breasts"` from
parsing as `packageType=breast, name=chicken`.

### Size Descriptors Table (new)
Qualitative physical size words — describe *how big*, not *what kind*.

**Seed values** (review at spec/implementation time):

| Canonical | Aliases |
|-----------|---------|
| large | lg |
| medium | med |
| small | sm |
| xl | extra-large |
| jumbo | — |
| mini | miniature |
| petite | — |
| king-size | — |
| family-size | — |
| travel-size | — |
| regular | — |

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
normalization), that pill is pre-selected in the add flow. Under structured storage,
this comparison becomes exact field matching with no normalization needed. See Dropdown
UI § Quantity Pills for the full pill display and interaction design (sorting, overflow,
"Other" behavior).

### Interim Serialization Format (pre-F79)

Until F79 implements structured quantity storage, F44 must serialize its structured
`ParsedInput` fields into the existing TEXT columns (`list_items.quantity`,
`items.alternate_qtys`). This format is transitional — F79 replaces it entirely with
structured field comparison.

**Serialization rule:** concatenate present fields in this order, space-separated:

```
[count"x"] [sizeQty + sizeUnit] [packageType]
```

| ParsedInput fields | Serialized string |
|--------------------|-------------------|
| `{count: 2, sizeQty: 8, sizeUnit: "oz", packageType: "can"}` | `2x 8oz can` |
| `{sizeQty: 1.5, sizeUnit: "lb"}` | `1.5lb` |
| `{count: 2, packageType: "loaf"}` | `2x loaf` |
| `{sizeDescriptive: "large"}` | `large` |
| `{count: 3, packageType: "12-pack"}` | `3x 12-pack` |
| `{sizeQty: 32, sizeUnit: "oz", packageType: "box"}` | `32oz box` |

Rules:
- Count is always followed by `x` with no space (e.g., `2x`), omitted when null
- Size qty and unit are fused with no space (e.g., `8oz`, `1.5lb`), omitted when null
- Package type is the canonical form, omitted when null
- Size descriptive stands alone when present

**Comparison rule for pill pre-selection:** Serialize both the parsed value and each
`alternate_qtys` entry using the same rules above, then compare strings. This
normalizes spacing variants: `"1.5 lb"` in the database and `"1.5lb"` from the parser
both serialize to `"1.5lb"`. Comparison is case-insensitive.

**Partial match for pill sorting** also operates on the serialized form — the serialized
parsed value is checked as a string prefix of each serialized alternate.

---

## Dropdown UI: Parsed Context in Result Rows

The dropdown result row is the primary surface for parsed context. Rather than a separate
"parse feedback" area, the **pills themselves are the feedback** — the user sees what the
parser extracted by looking at what's pre-selected and what options are available.

### Quantity Pills

**Principle:** Always show the parsed value and all defaults/alternates. Never hide
defaults based on what was parsed — the user may have mistyped and needs to see their
existing options. Sort by relevance to parsed input; cap to available space.

**Pill row contents (left to right):**
1. Parsed value pill (selected) — only if parser extracted a qty and it doesn't exactly
   match a default/alternate
2. Default qty
3. Alternate qtys — sorted with partial matches to parsed value first, then remaining
4. "Other" button
5. `...` if items overflow available space (opens edit modal)

**Display cap:** Pill rows have a configurable max-row limit (initially set to 2),
device-width-dependent. This cap applies universally — whether or not the parser
extracted a qty. When defaults/alternates alone exceed the cap, the same overflow/`...`
mechanism applies. The cap value can be adjusted in code without changing the design;
`...` always opens the edit modal where all options are visible.

**Partial match definition:** The parsed value string is a prefix of the alternate string.
`2` matches `2lb`, `2.5lb`, `2 pack`. `1.5lb` matches `1.5lb` exactly but NOT `1lb`
(since `"1.5"` is not a prefix of `"1"`). Under F79 structured storage, this becomes
structured field comparison rather than string prefix matching.

**Dedup:** If the parsed value exactly matches a default or alternate, don't show it
twice — just pre-select the matching pill.

#### Scenario walkthroughs

**No parsed qty** — today's behavior, with display cap applied:
```
Qty: [1] [32oz] [2 pack] [Other]
```
Same pills as today. If defaults/alternates exceed the row cap, overflow to `...`.

**Exact match** (`32oz` parsed, `32oz` is an alternate):
```
Qty: [1] [32oz ✓] [2 pack] [Other]
```
Normal order, matched pill pre-selected. No extra pill injected.

**Partial match** (`1` parsed, alternates include `1lb`, `1.5lb`, `2lb`, `32oz`, `2 pack`, `1 gal`):
```
Qty: [1 ✓] [1lb] [1.5lb] [1 gal] [2lb]
     [32oz] [2 pack] [Other]
```
Parsed value first (selected). Partial matches (`1lb`, `1.5lb`, `1 gal`) sorted next.
Non-matching alternates follow. Two rows.

**No match** (`16oz` parsed, alternates are `1`, `32oz`, `2 pack`):
```
Qty: [16oz ✓] [1] [32oz] [2 pack] [Other]
```
Parsed value first (selected). All defaults/alternates shown — nothing filtered out.
The user sees `32oz` right there and can tap it if they were close.

**Overflow** (many alternates, doesn't fit in two rows):
```
Qty: [1 ✓] [1lb] [1.5lb] [1 gal] [2lb]
     [32oz] [2 pack] [Other] [...]
```
`...` opens edit modal where all options are visible.

#### "Other" behavior

Tapping "Other" replaces the pill row with a text input pre-filled with the parsed
value (or empty if no qty was parsed). An `✕` button returns to the pill view.

```
Before:  Qty: [16oz ✓] [1] [32oz] [2 pack] [Other]
After:   Qty: [16oz________________] [✕]
```

The user has already seen all defaults/alternates before tapping Other, so they're
making an informed choice to go free-text. The text input auto-focuses.

**F79 note:** The "Other" text input slot should be wrapped in its own component.
Under F79, this slot may become a structured mini-form (number input + unit picker)
rather than free text. The interaction pattern (Other → input replaces pills) stays
the same; only the input control changes.

### Store Pills

**Principle:** Store pills only appear when the parser extracts a `@hint`. No hint →
no store pills; store inherits from the active store silently, same as today.

**Behavior by match count:**

| `@hint` matches | Pills shown |
|-----------------|-------------|
| 0 matches | No pills (hint shown as unresolved — user can refine input) |
| 1 match | `[Costco ✓]` — single pill, pre-selected |
| 2–N matches (fit one line) | `[Costco] [Country Market]` — first match pre-selected |
| Too many for one line | Show as many as fit + `[...]` — `...` opens edit modal |

Pills update live as the user refines the hint (`@c` → `@co` → `@cos` narrows the
set keystroke by keystroke). No submit required.

**Not locked, pre-populated:** The store hint pre-selects but does not lock. The user
can tap a different store pill or change the hint in the input. This follows the
"every inference is visible and overridable" principle.

### Edit Modal Enhancements

The edit modal (opened via the chevron or `...` overflow) carries parsed context
through and takes advantage of the additional screen space.

**Store in edit modal:**
- If a `@hint` was parsed, the store list is filtered to matching stores, shown first
- A `▸ More` row expands to show remaining stores below the matches
- Matching stores stay at the top after expansion for easy access
- If no `@hint`, behaves exactly as today (full store list, no filtering)

```
Store:
┌─────────────────────────────┐
│ ● Costco                    │  ← @co matches, shown first
│ ● Country Market            │
│ ▸ More                      │
└─────────────────────────────┘
```

**Quantity in edit modal:**
- Text input pre-filled with the parsed quantity value
- "Usual Quantities" tags shown below (same as today), with partial matches to
  parsed value sorted first
- Full list always visible — more room than the dropdown row

### Parse Feedback Model

**Decision:** No separate real-time parse feedback UI (no token coloring, no separate
parse-result display area). The pills themselves are the parse feedback — what's
pre-selected shows what the parser extracted. Orphan tokens (from Pass 5) shown
struck-through next to the item name in the result row.

This keeps the UI simple: the user's feedback loop is "type → see pills update →
tap or refine." The same UI elements that existed before F44 (qty pills, store
selection) now respond to parsed input — no new UI concepts introduced.

---

## Worked Examples

These show the **top-ranked interpretation** from `ParseResult.interpretations[0]`.
Additional interpretations may exist — see Pass 5 for ranking rules and examples.

| Input | count | package | size | store | name | orphans |
|-------|-------|---------|------|-------|------|---------|
| `2 milk` | 2 | — | — | — | milk | — |
| `milk @safeway` | — | — | — | safeway | milk | — |
| `milk 2` | 2 | — | — | — | milk | — |
| `1.5 lb chicken @costco` | — | — | 1.5 lb | costco | chicken | — |
| `2x milk` | 2 (explicit) | — | — | — | milk | — |
| `2 8oz cans chicken broth` | 2 | can | 8 oz | — | chicken broth | — |
| `2 8 oz cans chicken broth` | 2 | can | 8 oz | — | chicken broth (same) | — |
| `2x 8oz cans chicken broth @safeway` | 2 (explicit) | can | 8 oz | safeway | chicken broth | — |
| `2 packages 1.2 lb chicken breast` | 2 | package | 1.2 lb | — | chicken breast | — |
| `large avocado`* | — | — | — | — | Large Avocado | — |
| `large green avocado`* | — | — | — | — | Large Avocado | green |
| `2 loaves bread` | 2 | loaf | — | — | bread | — |
| `1 bunch cilantro` | 1 | bunch | — | — | cilantro | — |
| `3 12-pack Coke` | 3 | 12-pack | — | — | Coke | — |

*Assumes "Large Avocado" exists as a master item. If only "Avocado" exists,
top interpretation would be: name="Avocado", sizeDescriptive="large". See Pass 5
for the full ranked output with multiple interpretations.

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

1. ~~**Precedence rules (Pass 5)** — Resolved. See Design Decisions (ranked interpretations).~~

2. ~~**Data model — qty field when both count AND size parse** — Resolved. See Design Decisions (quantity storage format).~~

3. ~~**alternate_qtys structure** — Resolved. See Design Decisions.~~

4. ~~**UI decisions** — Resolved. See Dropdown UI section and Design Decisions (parse feedback model, store pills, qty pills).~~

5. ~~**Store prefix ambiguity** — Resolved. See Dropdown UI § Store Pills: multiple matches shown as pills, user refines hint to narrow, `...` overflow to edit modal.~~

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

### Pass 5 output: ranked interpretations with orphan tolerance
**Decision:** Pass 5 returns all valid interpretations as a ranked list (`ParseResult.interpretations`),
not a single winner. Ranking: longest name match first. NAME tokens
left over from a shorter match are carried in `orphans[]` — they do not disqualify an
interpretation. Orphan tokens are shown struck-through in the dropdown row.
**Rationale:** Free-form input is messy — users may include words that don't match their
master items (e.g., "large green avocado" when "Large Avocado" exists). Discarding
interpretations with orphans would hide valid matches. Showing ranked alternatives with
visible orphans lets the user see and choose which interpretation they intended, consistent
with the "every inference is visible and overridable" principle. The one-off add path (`rawInput`) provides an escape
when no interpretation is right.
**Alternatives considered:**
- Single longest match (original proposal): simpler, but silently discards shorter valid
  interpretations and gives the user no choice
- Drop interpretations with orphans: penalizes users for extra words; hides valid matches
  behind strict token accounting

### Parse feedback: pills are the feedback
**Decision:** No separate parse-feedback UI (no token coloring in the input, no parse
result display area). Parsed context surfaces through pre-selected pills (qty, store)
and struck-through orphans on the result row. The existing UI elements respond to parsed
input — no new UI concepts introduced.
**Rationale:** Adding a dedicated parse display (option B — tags below input, or option C —
token coloring) adds UI complexity for information that's already visible in the pills.
The user's feedback loop is "type → see pills update → tap or refine." Keeping feedback
implicit in existing controls means less to learn and less screen space used.

### Qty pills: always show all options, sort by relevance
**Decision:** The pill row always shows the parsed value (if any, selected) plus all
defaults/alternates sorted with partial matches first. Configurable max-row cap
(initially 2) with `...` overflow to edit modal — applies universally, not just when
a qty is parsed. "Other" replaces pills with a text input pre-filled with parsed
value. No filtering of defaults based on parsed input.
**Rationale:** Hiding defaults when the parsed value doesn't match them prevents the user
from discovering close matches (e.g., typed `16oz`, `32oz` is an alternate). Always
showing all options means the user sees what's available regardless of what they typed.
Sorting by partial match keeps the most relevant options visible within the row cap.

### Store pills: only on @hint, live-updating prefix match
**Decision:** Store pills only appear when `@hint` is present in the input. Multiple
prefix matches shown as pills (up to one line, `...` overflow). Pills update live as
the user refines the hint. Pre-selected, not locked — user can change. Edit modal shows
filtered stores first with `▸ More` to expand.
**Rationale:** Without a hint, the active store (header dropdown) applies silently — same
as today. Showing store pills only when the user explicitly signals intent (`@`) avoids
clutter on every result row. Live updating on keystroke gives immediate feedback without
a submit step. The edit modal's filtered-first approach keeps hint context without hiding
other stores.
**Q#5 resolution:** Multiple matches for an ambiguous prefix (e.g., `@co` → Costco +
Country Market) are shown as pills. The user either taps the right one or refines their
hint. No algorithmic disambiguation needed — the UI handles it.

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
- 2026-03-31: Resolved Open Q#1 (precedence rules) — Pass 5 returns ranked interpretations (not single winner); ranking by longest name match; orphan tokens carried in `orphans[]` field, shown struck-through in dropdown; `ParseResult` wraps `ParsedInput[]` + `rawInput`; partial Q#4 resolution (orphan display as struck-through)
- 2026-04-01: Resolved Open Q#4 (UI decisions) and Q#5 (store prefix ambiguity). Added Dropdown UI section covering qty pills (always show all defaults/alternates sorted by partial match, two-row cap, Other→text input), store pills (only on @hint, live-updating prefix match, ...overflow), edit modal enhancements (filtered store list with More, parsed qty pre-fill), and parse feedback model (pills are the feedback, no separate parse display). All open questions now resolved.
- 2026-04-01: Consistency review fixes — added interim serialization format for pre-F79 text storage; simplified \d+-pack to literal package string (no embedded multiplier decomposition); removed multi-word unit aliases from V1 seed data (single-token only); reformatted all vocabulary tables for review at spec time; updated principle references from "user always confirms" to "every inference is visible and overridable"
