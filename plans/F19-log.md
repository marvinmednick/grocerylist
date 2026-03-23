# F19 Feature Log — Store Management UI

## Spec (2026-03-22)

Spec written by Claude. Three issues batched: #53 (store edit), #54 (store delete with cascade warnings), #62 (store dropdown filter).

**Key decisions:**
- Edit/delete surfaced via pencil icon in StoreSelector dropdown per-store row
- Deletion confirmation shown inline in the edit modal (not Alert.alert) to allow displaying cascade counts
- Migration needed to change `shopping_trips.primary_store_id` FK to `ON DELETE SET NULL`
- Store dropdown filter threshold set at 6 stores; case-insensitive substring match; resets on close
- Undo registered for store renames; no undo for deletes (cascade side-effects too broad)

## 2026-03-22 — Review 1 (Needs Fixes)
- **Result:** Needs Fixes — 1 blocking issue
- **Tests:** 216/216 passed
- **Blocking:** Migration `20250101000013` exists locally but not applied to remote — store deletion will fail at runtime when trips reference the store
- **Non-blocking:** incidental timer fixes in `index-interactions-test.tsx` (harmless)
- **Next:** ~~Apply migration with `npx supabase db push`, then re-review~~ → Migration applied 2026-03-22; blocking issue resolved. Status → In Review.
