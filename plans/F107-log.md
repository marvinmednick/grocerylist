# F107 — Warning Recompute on Entry Store Change

GitHub: [#107](https://github.com/marvinmednick/grocerylist/issues/107)

Fix deferred from F104: `list_items.warnings` was not recomputed when an entry's `store_id` was edited. Implemented as option 3 from the issue (recompute on `useUpdateQuantityEntry` store change).

---

## 2026-04-20 — Review 1 (Passed)

- **Result:** Passed — no blocking code issues. Process artifacts were missing (no progress file, no spec, not in PLAN.md at time of review) — flagged and resolved during review.
- **Tests:** 645/645 passed (9/9 in list-f104-test.tsx including 2 new F107 tests)
- **Non-blocking:**
  - `'store_id' in updates` is more idiomatic than `Object.prototype.hasOwnProperty.call`
  - `index.tsx:handleSaveEdit` always passes `store_id` in `entryUpdates`, so `recomputeListItemWarnings` fires even for quantity-only inline edits (harmless but extra work)
  - `dedupeWarnings` uses `JSON.stringify` key-order-dependent dedup (works because `computeWarnings` constructs fields in consistent order)

---

## 2026-04-20 — Shipped
- **Commit:** `fix: recompute list item warnings on entry store_id change (#107)`
- **Closed:** #107
