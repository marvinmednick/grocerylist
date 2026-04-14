# Implementation Plan: F102 Optimistic Toggle for Shopping List Checkboxes

## Files to Modify

- `client/api/list.ts` —
  1. **Replace `useTogglePurchased` with optimistic mutation callbacks** — update the hook to initialize `queryClient` via `useQueryClient()` and add `onMutate`, `onError`, and `onSettled` on the `useMutation` options object so checkbox state updates immediately in the `['shopping_list']` cache before the network round-trip.
  2. **Implement `onMutate` cache lifecycle with exact query key** — call `await queryClient.cancelQueries({ queryKey: ['shopping_list'] })`, snapshot cache with `queryClient.getQueryData<ListItem[]>(['shopping_list'])`, then optimistically map the list via `queryClient.setQueryData<ListItem[]>(['shopping_list'], ...)` to update `is_purchased`, `purchased_at`, and `purchased_by` for the matching `id`. The optimistic values must match the mutation's computed values exactly: on check, `purchased_at = new Date().toISOString()` and `purchased_by = purchased_by_override ?? userId`; on uncheck, both are `null`.
  3. **Implement rollback and refetch callbacks** — in `onError`, restore `context.previous` with `queryClient.setQueryData(['shopping_list'], context.previous)` when present; in `onSettled`, always call `queryClient.invalidateQueries({ queryKey: ['shopping_list'] })`.
  4. **Keep mutation-side write behavior but remove response selection** — keep `incrementLocalMutation()` / `decrementLocalMutation()` wrapping the Supabase update in `try/finally`, preserve `purchased_by_override` fallback behavior, and remove `.select().single()` so the update chain ends at `.eq('id', id)` and the `mutationFn` returns `void`.
  5. **Ensure:** Do not change query key names (`['shopping_list']`), do not alter purchased-field semantics (`purchased_at` timestamp on purchase, `null` on unpurchase; `purchased_by` override/userId/null logic), and do not modify other list mutations or realtime subscription behavior.

## New Files

- `client/api/__tests__/list-toggle-optimistic-test.tsx` — add focused tests that capture the `useMutation` options object and directly invoke callbacks (`onMutate`, `onError`, `onSettled`) to verify:
  1. **Optimistic cache update — check direction.** Seed cache with an item where `is_purchased: false`; invoke `onMutate` with `{ is_purchased: true }`; assert the cache entry now has `is_purchased: true`, a non-null `purchased_at` ISO timestamp, and `purchased_by: userId`.
  2. **Optimistic cache update — uncheck direction.** Seed cache with an item where `is_purchased: true`; invoke `onMutate` with `{ is_purchased: false }`; assert the cache entry now has `is_purchased: false`, `purchased_at: null`, and `purchased_by: null`.
  3. **Optimistic cache update — `purchased_by_override` honored.** Seed cache; invoke `onMutate` with `{ is_purchased: true, purchased_by_override: 'user-B' }`; assert cache shows `purchased_by: 'user-B'`.
  4. **End-to-end rollback sequence on error.** Seed cache with initial state A; invoke `onMutate` and assert the cache is now mutated (state B) and a snapshot context is returned; then invoke `onError` with the returned context and assert the cache is restored to state A. This test exercises the full `onMutate` → `onError` sequence rather than calling `onError` with a fabricated context, so it proves the snapshot captured in `onMutate` is the correct one.
  5. **`onSettled` invalidates `['shopping_list']`.** Invoke `onSettled`; assert `queryClient.invalidateQueries` was called with `{ queryKey: ['shopping_list'] }`. Verify this occurs on both success (no error) and error paths.
  6. **Mutation chain does not call `.select()` or `.single()`.** Mock the Supabase chain; after running `mutationFn`, assert the chain ends at `.eq('id', id)` and that `.select` and `.single` spies were never called.
  7. **Existing `list-f2-test.tsx` coverage remains valid.** The 4 existing `purchased_by` tests in `list-f2-test.tsx` must continue to pass without modification. The existing `mockUseMutation` pattern extracts `mutationFn` directly and does not exercise `onMutate` / `onError` / `onSettled`, so it is compatible.

## Patterns Applying
- Realtime Mutation Tracking: Yes — `useTogglePurchased` writes to `list_items`, so `incrementLocalMutation`/`decrementLocalMutation` must remain around the Supabase update.
- Household Guard: No — spec changes an `update` mutation (not an insert), so no `householdId` null guard is required.
- Undo Registration: No — this feature is API-layer optimistic behavior in `useTogglePurchased`; screen-level `pushAction` registration remains where it already exists and is not changed by this spec.
- Optimistic Updates (CODING.md §4): Yes — this feature establishes the pattern. Implementation must match the reference `onMutate` / `onError` / `onSettled` shape in CODING.md §4.

## Ambiguities / Questions
- None
