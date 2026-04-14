# F102 — Optimistic Toggle for Shopping List Checkboxes

> **Issue:** [#102](https://github.com/marvinmednick/grocerylist/issues/102)
> **Closes on ship:** #102

## Overview

Toggling a shopping list checkbox has noticeable lag (~500ms+) because the UI waits for the Supabase round-trip before updating. The mutation currently: (1) sends the update and awaits the response with `.select().single()`, (2) on success, invalidates the query to refetch the full list. Two server round-trips before the checkbox visually changes.

Fix: add React Query optimistic updates so the cache is updated instantly in `onMutate`, with rollback in `onError`. Also drop the unnecessary `.select().single()` from the mutation since the response data is no longer needed.

## Changes

### 1. Optimistic Cache Update in `useTogglePurchased`

**File:** `client/api/list.ts`

Replace the current `useTogglePurchased` implementation (lines 102–131) with an optimistic update pattern:

```typescript
export const useTogglePurchased = () => {
  const queryClient = useQueryClient();
  const { userId } = useHousehold();

  return useMutation({
    mutationFn: async ({ id, is_purchased, purchased_by_override }: { id: string; is_purchased: boolean; purchased_by_override?: string | null }) => {
      incrementLocalMutation();
      try {
        const { error } = await supabase
          .from('list_items')
          .update({
            is_purchased,
            purchased_at: is_purchased ? new Date().toISOString() : null,
            purchased_by: is_purchased ? (purchased_by_override !== undefined ? purchased_by_override : userId) : null,
          })
          .eq('id', id);

        if (error) throw error;
      } finally {
        decrementLocalMutation();
      }
    },
    onMutate: async ({ id, is_purchased, purchased_by_override }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['shopping_list'] });

      // Snapshot the previous cache value for rollback
      const previous = queryClient.getQueryData<ListItem[]>(['shopping_list']);

      // Optimistically update the cache
      queryClient.setQueryData<ListItem[]>(['shopping_list'], (old) =>
        old?.map((item) =>
          item.id === id
            ? {
                ...item,
                is_purchased,
                purchased_at: is_purchased ? new Date().toISOString() : null,
                purchased_by: is_purchased ? (purchased_by_override !== undefined ? purchased_by_override : userId) : null,
              }
            : item
        )
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back to the snapshot on failure
      if (context?.previous) {
        queryClient.setQueryData(['shopping_list'], context.previous);
      }
    },
    onSettled: () => {
      // Always refetch after mutation to ensure server truth
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};
```

**Key differences from current code:**

1. **`onMutate`** — Cancels in-flight queries, snapshots cache, updates cache optimistically. Returns snapshot for rollback.
2. **`onError`** — Restores snapshot if the server call fails.
3. **`onSettled`** replaces `onSuccess` — Invalidates on both success and error to resync with server truth.
4. **Drop `.select().single()`** — The mutation no longer needs the response body. Chain ends at `.eq('id', id)`.
5. **Return type** — `mutationFn` returns `void` instead of `data`. This is safe because nothing in the codebase uses the return value of `togglePurchased`.

### 2. No Changes Needed Elsewhere

- `index.tsx` `handleToggle` calls `togglePurchased` with `await` but doesn't use the return value — no change needed.
- Undo/redo calls the same mutation, which will also benefit from the optimistic update.
- The realtime subscription in `useShoppingList` will still fire `invalidateQueries` on remote changes, keeping things in sync.

## Tests to Write

**File:** `client/api/__tests__/list-toggle-optimistic-test.tsx`

Create a new test file (the existing `list-f2-test.tsx` tests the purchased_by logic which remains unchanged).

1. **Optimistic cache update on toggle** — Set up query cache with a list item, call `onMutate` with `is_purchased: true`, verify the cache is updated immediately without awaiting the mutation.

2. **Rollback on error** — Set up query cache, call `onMutate` to get context, then call `onError` with the context. Verify cache is restored to the snapshot.

3. **onSettled invalidates queries** — Verify `invalidateQueries` is called with `['shopping_list']` after mutation completes (both success and error paths).

4. **Mutation does not use .select()** — Verify the Supabase update chain ends at `.eq()` (no `.select()` or `.single()` call).

5. **Existing purchased_by tests still pass** — The 4 tests in `list-f2-test.tsx` should continue to pass. The `mockUseMutation` pattern there extracts `mutationFn` directly, which still works since the mutation function signature is unchanged.

### Test approach

The tests need to exercise the `onMutate`, `onError`, and `onSettled` callbacks directly. Since `useMutation` is mocked, the test should capture the options object passed to `useMutation` and call the callbacks manually:

```typescript
mockUseMutation.mockImplementation((options: any) => {
  // Store options so tests can call onMutate, onError, onSettled directly
  latestMutationOptions = options;
  return { mutateAsync: async (args: any) => { /* ... */ } };
});
```

## Implementation Commands

### Gemini

```bash
GEMINI_PROMPT="Read AGENT.md and CODING.md first, then implement specs/F102-optimistic-toggle.md"

./gemini_edit.sh "$GEMINI_PROMPT" \
  client/api/list.ts \
  client/api/__tests__/list-toggle-optimistic-test.tsx
```

### aider

```bash
aider \
  client/api/list.ts \
  client/api/__tests__/list-toggle-optimistic-test.tsx \
  --message "Read AGENT.md and CODING.md first, then implement specs/F102-optimistic-toggle.md"
```
