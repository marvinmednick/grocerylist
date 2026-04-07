# Design: Fuzzy Matching in Smart Add
<!-- ID: F77 | Status: Designed -->
<!-- Parent architecture doc: docs/design/vocabulary-and-quantity-architecture.md -->

## Overview

Enhances the SmartAddItem input pipeline with typo tolerance, plural normalization, and fuzzy matching at the token level. Rather than a separate "fuzzy results" section, fuzzy matching is integrated into the existing name resolution and vocabulary classification steps — making the current ranked list smarter without changing the dropdown structure.

## User Scenarios

### Scenario A: Typo in product name word
- **Input:** "chicken rest boneless"
- **Expected:** "Chicken Breast Boneless Skinless" ranks first — "rest" fuzzy-matched to "breast" (edit distance 1). "Chicken Thighs" ranks lower (2 orphans vs 0).

### Scenario B: Typo in vocabulary token
- **Input:** "2 botles olive oil"
- **Expected:** "botles" fuzzy-matches "bottle" → classified as PACKAGE. Parse produces count=2, package=bottle, name="olive oil". Same structured result as correctly typed "2 bottles olive oil".

### Scenario C: Plural normalization
- **Input:** "chicken breasts"
- **Expected:** "breasts" normalized to "breast" → exact match against "Chicken Breast". No edit distance needed.

### Scenario D: Irregular plural beyond edit distance
- **Input:** "cherries"
- **Expected:** "cherries" normalized to "cherry" → exact match against "Cherry". Edit distance alone (distance 3) would miss this.

### Scenario E: Fuzzy alias key match
- **Input:** User has alias "chkn" → "chicken". Types "chk" (forgot the n).
- **Expected:** "chk" fuzzy-matches alias key "chkn" (distance 1) → expands to "chicken" → matches chicken items.

### Scenario F: Mixed exact + fuzzy tokens
- **Input:** "2 chiken brest @costco"
- **Expected:** "chiken" → "chicken" (fuzzy, distance 1), "brest" → "breast" (fuzzy, distance 1). "Chicken Breast" matched with 0 orphans, 2 fuzzy words. Store hint @costco parsed normally.

### Scenario G: Short query, no fuzzy
- **Input:** "be"
- **Expected:** No fuzzy matching (< 3 chars). Only exact prefix matching as today.

---

## Design Decisions

### Token-level fuzzy matching, not item-level
**Decision:** Fuzzy matching operates on individual words within name resolution, not as a separate item-level pass. When a name word doesn't match any item word exactly or by prefix, edit-distance matching is attempted against each word in the item name.
**Rationale:** Grocery queries are multi-word ("chicken rest boneless"), and the interesting fuzzy work happens per-word. A separate "fuzzy section" in the dropdown doesn't make sense when one item can have a mix of exact and fuzzy-matched words. This approach uses the existing ranking logic (fewer orphans = better) — fuzzy matching simply prevents typo'd words from becoming orphans.
**Alternatives considered:** Post-parser fuzzy fallback (Option 1 from design conversation) — rejected because it wouldn't fire when exact matches exist, missing the common case of "mostly right input with one typo."

### Single ranked list, no two-section dropdown
**Decision:** The dropdown remains a single ranked list. No "Best Matches" vs "Did you mean?" sections.
**Rationale:** With token-level fuzzy matching, the boundary between "exact" and "fuzzy" results is per-word, not per-item. An item matched with 2 exact words and 1 fuzzy word is clearly a best match, not a suggestion. The scoring model handles ranking naturally.

### Matching strategies in scope
**Decision:** V1 includes all of the following:

| Strategy | What it does | Where it plugs in |
|----------|-------------|-------------------|
| **Plural normalization** | Strip common suffixes before matching | Name resolution + prefix fallback |
| **Edit-distance on name words** | Tolerate typos in product name tokens | Name resolution (`resolveNames`) + prefix fallback |
| **Edit-distance on vocabulary tokens** | Tolerate typos in unit/package/size words | Pass 2 (`classifyTokens`) — fuzzy fallback on lookup miss |
| **Edit-distance on alias keys** | Tolerate typos in token alias shorthand | Alias expansion step — fuzzy scan of `wordAliases` map |

**Rationale:** The Levenshtein function is the core work. Applying it to vocab lookups and alias keys is incremental effort (same function, different call sites) with real mobile-keyboard usability wins.

### Out of scope
- **Substring/contains matching** — noisy, overlaps with prefix matching. Revisit in F83 if needed.
- **Phonetic matching** (Soundex/Metaphone) — overkill for grocery vocabulary.
- **Learning from user corrections** — no infrastructure for this; unclear payoff.

### Edit distance thresholds
**Decision:** Thresholds scale with word length:
- Word length < 3: no fuzzy matching (too noisy)
- Word length 3–4: max edit distance 1
- Word length 5+: max edit distance 2

**Rationale:** Standard autocomplete/spell-check thresholds. Distance 2 on a 3-letter word changes 67% of it (likely a different word). Distance 2 on a 7-letter word changes 29% (likely a typo). Can be tuned after observing real results.

### Plural normalization approach
**Decision:** Simple suffix stripping applied during name word matching only (late, not pre-classification). Rules: remove trailing "s", "es", "ies"→"y". Applied to both input tokens and item name tokens before comparison.
**Rationale:** Covers 90%+ of grocery plurals. Applied late so it doesn't interfere with vocabulary lookups in Pass 2 (which already handle plurals like "cans"→"can" via the packages table). A stemming library is overkill for this domain.

### Normalization runs before edit distance
**Decision:** Pipeline order is: plural normalization → exact match → prefix match → edit distance. A normalized exact match is preferred over a fuzzy match.
**Rationale:** "breasts"→"breast" is a clean normalization, not a guess. It should score as exact (score 2), not fuzzy (score 1). Edit distance is the fallback when normalization doesn't help.

### Match quality scoring
**Decision:** Each input token is scored by how it matched:
- **Exact match** (including after plural normalization) = 2
- **Fuzzy match** (edit distance) = 1
- **Orphan** (unmatched) = 0

Item rank = sum of token scores. Ties broken by longer item name (more specific).

**Rationale:** Simple, deterministic, and produces intuitive rankings. "Chicken Breast" with score 5 (2+1+2 for "chicken rest boneless") clearly beats "Chicken" with score 2 (2+0+0). No floating-point confidence scores or tuning knobs needed.

### No result cap
**Decision:** No artificial limit on the number of fuzzy-enhanced results.
**Rationale:** The scoring model and existing min-2-char query threshold keep results manageable. A cap would arbitrarily hide valid matches.

---

## Pipeline Integration

### Where fuzzy matching plugs in

```
Pass 1 — Tokenize
Pass 2 — Per-Token Classification (vocabulary lookup — now with fuzzy fallback)
Pass 3 — Adjacent Token Grouping
Pass 4 — Candidate Assembly
Token Alias Expansion (now with fuzzy key lookup)
Pass 5 — Name Resolution (now with plural normalization + edit distance)
Pass 6 — Output (scoring updated)
```

### Pass 2 changes (vocabulary fuzzy)
When a token doesn't match any vocabulary entry exactly, attempt fuzzy matching against all entries in the relevant table (units, packages, size descriptors). Accept the closest match within the edit distance threshold. If multiple entries tie, prefer the shorter canonical form.

### Alias expansion changes (fuzzy key lookup)
When a name word doesn't have an exact alias key match, scan all `wordAliases` keys with edit distance. Accept the closest match within threshold. The alias map is small (20–100 entries), so a linear scan is cheap.

### Name resolution changes (plural normalization + edit distance)
`resolveNames` and the prefix fallback gain a multi-tier matching strategy per word:
1. **Exact match** — word equals item word (current behavior)
2. **Plural-normalized match** — strip plural suffix from both sides, re-check exact
3. **Prefix match** — word is a prefix of item word (current prefix fallback behavior)
4. **Edit distance match** — Levenshtein distance within threshold

Each tier is tried in order; first match wins. The match tier determines the token's score (exact/normalized = 2, fuzzy = 1).

---

## UI Changes

### Dropdown — no structural changes
**Classification:** Established pattern — no new UI elements.

The dropdown remains a single ranked list with the same row layout as today. Fuzzy matching improves which items appear and how they rank, but the visual presentation is unchanged:
- Item name, qty pills, store pills — same as today
- Orphan tokens — still shown as strikethrough (fewer orphans now, since fuzzy matching resolves some)
- One-off / "Create New" row — unchanged, always at the bottom
- No visual indicator for fuzzy-corrected words in V1 (see Out of Scope)

### No new screens, modals, or components
F77 is purely a matching engine improvement. All changes are in parser/matching logic. No new UI surfaces.

---

## Out of Scope

- **Substring/contains matching** — noisy, overlaps with prefix matching. Revisit in F83 if needed.
- **Phonetic matching** (Soundex/Metaphone) — overkill for grocery vocabulary.
- **Learning from user corrections** — no infrastructure for this; unclear payoff.
- **Visual indicator for fuzzy/alias matches** — backlog item. When a word was fuzzy-corrected or alias-expanded, showing a subtle visual cue (italic, color, annotation) could help users understand *why* a result appeared. Deferred from V1 — the ranking is self-explanatory for obvious typos. Revisit when alias and fuzzy matching have real-world usage.

---

## Open Questions

None — all design questions resolved.

---

## Revision History
- 2026-04-06: Initial draft — functional decisions from design conversation Pass 1. Token-level fuzzy matching (not item-level). Single ranked list (no two-section dropdown). Scope: plural normalization + edit distance on name words, vocab tokens, and alias keys. Scoring model: exact=2, fuzzy=1, orphan=0.
- 2026-04-06: Pass 2 — UI decisions. No structural dropdown changes. No new screens or components. Visual indicator for fuzzy/alias matches deferred to backlog.
