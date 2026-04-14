# Implementation Plan: F102 Optimistic Toggle for Shopping List Checkboxes

## Files to Modify

- `client/api/list.ts` —
  1. **Replace `useTogglePurchased` with optimistic mutation callbacks** — update the hook to initialize `queryClient` via `useQueryClient()` and add `onMutate`, `onError`, and `onSettled` on the `useMutation` options object so checkbox state updates immediately in the `['shopping_list']` cache before the network round-trip.
  2. **Implement `onMutate` cache lifecycle with exact query key** — call `await queryClient.cancelQueries({ queryKey: ['shopping_list'] })`, snapshot cache with `queryClient.getQueryData<ListItem[]>(['shopping_list'])`, then optimistically map the list via `queryClient.setQueryData<ListItem[]>(['shopping_list'], ...)` to update `is_purchased`, `purchased_at`, and `purchased_by` for the matching `id`.
  3. **Implement rollback and refetch callbacks** — in `onError`, restore `context.previous` with `queryClient.setQueryData(['shopping_list'], context.previous)` when present; in `onSettled`, always call `queryClient.invalidateQueries({ queryKey: ['shopping_list'] })`.
  4. **Keep mutation-side write behavior but remove response selection** — keep `incrementLocalMutation()` / `decrementLocalMutation()` wrapping the Supabase update in `try/finally`, preserve `purchased_by_override` fallback behavior, and remove `.select().single()` so the update chain ends at `.eq('id', id)` and the `mutationFn` returns `void`.
  5. **Ensure:** Do not change query key names (`['shopping_list']`), do not alter purchased-field semantics (`purchased_at` timestamp on purchase, `null` on unpurchase; `purchased_by` override/userId/null logic), and do not modify other list mutations or realtime subscription behavior.

## New Files

- `client/api/__tests__/list-toggle-optimistic-test.tsx` — add focused tests that capture the `useMutation` options object and directly invoke callbacks (`onMutate`, `onError`, `onSettled`) to verify:
  1. optimistic cache update occurs immediately for `is_purchased: true`
  2. rollback restores snapshot on error
  3. `onSettled` invalidates `['shopping_list']` after completion
  4. mutation chain does not call `.select()` or `.single()` (ends at `.eq()`)
  5. existing purchased-by coverage in `list-f2-test.tsx` remains valid/unchanged by this feature

## Patterns Applying
- Realtime Mutation Tracking: Yes — `useTogglePurchased` writes to `list_items`, so `incrementLocalMutation`/`decrementLocalMutation` must remain around the Supabase update.
- Household Guard: No — spec changes an `update` mutation (not an insert), so no `householdId` null guard is required.
- Undo Registration: No — this feature is API-layer optimistic behavior in `useTogglePurchased`; screen-level `pushAction` registration remains where it already exists and is not changed by this spec.

## Ambiguities / Questions
- None
