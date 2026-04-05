## Progress Log

### Files
- ✅ `supabase/migrations/20250101000015_f85_packages_plural.sql` — added migration to create/backfill `packages.plural`, enforce NOT NULL, and remove plural values from aliases.
- ✅ `supabase/full_schema.sql` — added `packages.plural` column in schema and moved package plural seed values out of aliases into explicit `plural` values.
- ✅ `client/lib/vocabulary.ts` — added plural-aware vocabulary types/defaults, introduced `lookupPackageEntry`, updated token lookup to match explicit plural, and deprecated `getPlural` via JSDoc.
- ✅ `client/lib/parser.ts` — changed package token values to structured `{ canonical, plural }`, added `packagePlural` to candidate/parsed outputs, and propagated plural through grouping and resolution.
- ✅ `client/lib/quantityFormat.ts` — added `packagePlural` and exported `QuantityParsed`, removed formatter dependency on default vocabulary plural lookup, and added exported `parseQuantityText`.
- ✅ `client/api/vocabulary.ts` — added package `plural` support in query row shape, package create/update payloads, and reset-to-default inserts.
- ✅ `client/api/list.ts` — extended `ListItemInsert` with optional `quantity_parsed` typed as `QuantityParsed | null`.
- ✅ `client/api/items.ts` — added parsed quantity field types for create/update payloads (`default_qty_parsed`, `alternate_qtys_parsed`).
- ✅ `client/app/auth.tsx` — updated household package vocabulary seeding to include explicit `plural` values.
- ✅ `client/components/VocabularyManagement.tsx` — added package plural input state/UI with auto-fill + manual override and included plural in package save/update payloads.
- ✅ `client/components/SmartAddItem.tsx` — added parsed-quantity extraction/parsing and populated `quantity_parsed` on all add-to-list paths plus parsed default qty on new master-item creation.
- ✅ `client/app/(tabs)/items.tsx` — added vocabulary-backed quantity parsing on save/update payloads and included parsed pre-edit values in undo snapshots.
- ✅ `client/lib/__tests__/parser-test.ts` — updated package token assertions to structured values, added packagePlural propagation coverage, and adjusted match input to an existing master item.
- ✅ `client/lib/__tests__/quantityFormat-test.ts` — updated `formatQuantity` expectations for explicit `packagePlural` and added comprehensive `parseQuantityText` coverage.
- ✅ `client/lib/__tests__/vocabulary-test.ts` — added `lookupPackageEntry` coverage (including irregular plural) while retaining lookup/getPlural compatibility checks.
- ✅ `client/api/__tests__/vocabulary-test.ts` — updated package create/update/reset expectations to include `plural` payloads and package query shape.
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — added assertions that quick-add/one-off add write `quantity_parsed` (including `packagePlural`) and send null when interpretation has no quantity fields.
- ✅ `client/components/__tests__/VocabularyManagement-test.tsx` — added package plural field visibility/auto-fill/manual override tests and create payload assertion with plural.
- ✅ `client/app/(tabs)/__tests__/items-f85-test.tsx` — added parsed quantity payload tests for create/edit flows, alternate alignment/null handling, and undo restoration of parsed snapshots.
- ✅ `BACKLOG.md` — deferred F85 inline-list parsed-quantity note already present; verified no additional edit required.
- ✅ `client/app/(tabs)/__tests__/items-test.tsx` — added `useVocabulary` mock to keep legacy Items tests isolated from React Query provider requirements.
- ✅ `client/app/(tabs)/__tests__/items-sort-filter-test.tsx` — added `useVocabulary` mock to keep sort/recent tests isolated from React Query provider requirements.
- ✅ `client/app/(tabs)/__tests__/items-store-filter-test.tsx` — added `useVocabulary` mock to keep store-filter tests isolated from React Query provider requirements.
- ✅ `client/app/__tests__/ItemsScreen-store-prefs-test.tsx` — added `useVocabulary` mock so store-preference redesign tests remain isolated from React Query provider requirements.
- ✅ `client/components/SmartAddItem.tsx` — normalized write-time `quantity`/`default_qty` text with `formatQuantity` when parsed values are present; raw text still passes through when unparseable.
- ✅ `client/app/(tabs)/items.tsx` — normalized write-time `default_qty` and `alternate_qtys` text from parsed quantities while preserving raw values for unparseable entries.
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — added quick-add normalization assertion (`"2 Cans"` -> `"2 cans"`) and raw-text fallback assertion when parsed quantity is null.
- ✅ `client/app/(tabs)/__tests__/items-f85-test.tsx` — added normalization/raw-fallback assertions for `default_qty` and `alternate_qtys` alongside existing parsed payload coverage.
- ✅ `client/components/SmartAddItem.tsx` — refined normalization to fall back to raw text when `formatQuantity(parsed)` returns empty (e.g. count-only `1`), preventing blank writes.
- ✅ `client/app/(tabs)/items.tsx` — added same empty-normalization fallback so parsed count-only quantities do not overwrite `default_qty`/alternate text with blanks.
- ✅ `client/components/__tests__/SmartAddItem-test.tsx` — aligned one-off quantity expectation with normalized formatter output (`"3 lbs"` -> `"3lb"`).
- ✅ `client/app/(tabs)/__tests__/items-f85-test.tsx` — aligned alternate quantity normalization assertions with formatter output (`1 lb` -> `1lb`).

### Issues
- None

### Status
Complete

---

## Needs Fixes

**Status moved back to Needs Fixes after post-review design clarification.**

Read this section before touching any code. Only the two files below need changes — everything else is correct.

### What changed

The spec was missing write-time normalization of the `quantity` TEXT field. When `quantity_parsed` is non-null, `quantity` must be set to `formatQuantity(quantity_parsed)` at write time, not left as the raw user input. This ensures display is always consistent.

The display model is **write-time normalization** (not parsed-first rendering):
- `quantity` TEXT is still the display field — no display components change
- At write time: `quantity_parsed != null ? formatQuantity(quantity_parsed) : rawText`
- One-off / unparseable items: `quantity` stores raw text unchanged, `quantity_parsed` is null

See the updated **Display Model** section of `specs/F85-structured-quantity-conversion.md` and the updated **SmartAddItem** and **items.tsx** write-path sections for exact code patterns.

### File 1: `client/components/SmartAddItem.tsx`

In each of the four `addItem()` call sites, after computing `quantity_parsed`, derive the normalized `quantity` value:

```typescript
const qp = extractQuantityParsed(interpretation); // or parseQuantityText(...)
const normalizedQty = qp ? formatQuantity(qp) : rawQtyText;
addItem({ ..., quantity: normalizedQty, quantity_parsed: qp });
```

| Call site | raw qty fallback |
|-----------|-----------------|
| `onCommitAdd` | `interpretation.quantity` (the existing raw qty string) |
| `onOneOffAdd` | `oneOffQty` |
| `onOneOffEditAdd` | `editQty` |
| `onSaveEdited` — `addItem()` | `editQty` |

Also normalize `default_qty` when calling `createMasterItem` in the `onSaveEdited` no-existing-item path:
```typescript
const dqp = parseQuantityText(editQty, vocab);
createMasterItem({ ..., default_qty: dqp ? formatQuantity(dqp) : editQty, default_qty_parsed: dqp });
```

Import `formatQuantity` from `@/lib/quantityFormat` if not already imported.

### File 2: `client/app/(tabs)/items.tsx`

In `handleSave`, normalize `default_qty` and each `alternate_qtys[]` element alongside the parsed fields:

```typescript
const altQtyArray = altQtys.split(',').map((v) => v.trim()).filter((v) => v.length > 0);
const dqp = parseQuantityText(qty, vocab);
const altParsed = altQtyArray.length > 0
  ? altQtyArray.map((q) => parseQuantityText(q, vocab))
  : null;
const parsedPayload = {
  default_qty: dqp ? formatQuantity(dqp) : qty,
  default_qty_parsed: dqp,
  alternate_qtys: altQtyArray.length > 0
    ? altQtyArray.map((q, i) => { const p = altParsed![i]; return p ? formatQuantity(p) : q; })
    : [],
  alternate_qtys_parsed: altParsed,
};
```

Spread `parsedPayload` into `payload`, overriding the existing `default_qty` and `alternate_qtys` text fields.

Import `formatQuantity` from `@/lib/quantityFormat` if not already imported.

### Tests to add/update

#### `client/components/__tests__/SmartAddItem-test.tsx`
- Add: `it('normalizes quantity to formatQuantity output on quick-add when parsed')` — interpretation parses "2 Cans"; assert `addItem` called with `quantity: "2 cans"` (normalized)
- Add: `it('passes raw quantity text when quantity_parsed is null')` — all-null interpretation; assert `quantity` is the original raw text unchanged

#### `client/app/(tabs)/__tests__/items-f85-test.tsx`
- Add: `it('normalizes default_qty to formatQuantity output when parsed')` — fill qty "2 Cans"; save; assert `default_qty: "2 cans"`
- Add: `it('passes raw default_qty text when unparseable')` — fill qty "a lot"; assert `default_qty: "a lot"` and `default_qty_parsed: null`
- Add: `it('normalizes parseable alternate_qtys entries')` — altQtys "2 Cans, 1 lb"; assert `alternate_qtys[0] === "2 cans"` and `alternate_qtys[1] === "1 lb"`
- Add: `it('passes raw text for unparseable alternate_qty element')` — altQtys "1 lb, blah"; assert `alternate_qtys[1] === "blah"`

### No replan needed

This is a targeted fix. Do not re-run `--plan`. Apply the changes directly from this section, run `npm test`, confirm all tests pass, then report back.
