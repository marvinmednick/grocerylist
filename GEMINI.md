# GEMINI.md

This file provides guidance for implementing code in this repository. Architecture and design decisions are handled separately — if a task requires a new pattern, schema change, or significant structural decision, consult the spec provided or ask before proceeding.

## Running a Spec

Specs are written by Claude and saved to `specs/[feature-slug].md`. Each spec contains everything needed to implement a feature — files to modify, query shapes, patterns to follow, and specific test cases.

### Gemini CLI
```bash
gemini "Read GEMINI.md and specs/list-interactions.md, then implement the spec. Run npm test from client/ before reporting back."
```
Or point it at both files directly if your CLI supports file arguments.

### Copy-Paste (AI Studio or other interface)
Paste the following into your prompt, in this order:
1. The full contents of `GEMINI.md`
2. The full contents of the spec file (`specs/[feature-slug].md`)
3. Any source files the spec says to modify (optional but helps avoid hallucination on existing code)

Then append:
> "Implement the spec above following the conventions in GEMINI.md. Run all tests and confirm they pass before reporting back. List every file you changed."

### What to Report Back
Gemini should return:
- Every file changed (diffs or full file contents)
- Test output confirming all tests pass
- Any spec sections that couldn't be implemented as written, with explanation

Bring the output back to Claude and run `/review` to verify before committing.

## Tech Stack

- **React Native** (Expo ~54, New Architecture enabled) + TypeScript
- **Expo Router** v6 — file-based routing
- **Supabase** — PostgreSQL + Auth + Realtime
- **TanStack Query (React Query v5)** — all server state
- **NativeWind is installed but NOT used in components** — use `StyleSheet.create()` exclusively
- **lucide-react-native** for icons
- **react-native-draggable-flatlist** for the shopping list

## Commands (run from `client/`)

```bash
npm start             # dev server (interactive)
npm run web           # web only
npm test              # all tests
npm test -- --testPathPattern=SmartAddItem  # single test file
```

**Required `client/.env`:**
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_HOUSEHOLD_MODE=single   # or "multi"
```

## File Organization

```
client/
  app/
    _layout.tsx          # root layout — providers live here
    auth.tsx             # sign in/up + profile creation
    (tabs)/index.tsx     # shopping list screen
    (tabs)/items.tsx     # master item library screen
  api/
    list.ts              # list_items CRUD + realtime + trips
    items.ts             # master items CRUD
    metadata.ts          # stores + categories (read-only, cached)
    undoContext.tsx       # undo/redo context + provider
  components/
    SmartAddItem.tsx     # add-item search UI
    Toast.tsx            # remote-change notification
  lib/
    supabase.ts          # supabase client
    household.tsx        # HouseholdProvider + useHousehold()
```

**Where to put new code:**
- New Supabase queries/mutations → new file in `api/` or add to the relevant existing file
- New reusable UI → new file in `components/`
- New screens → new file in `app/(tabs)/` or `app/`
- Do not add business logic to screen files; it belongs in `api/`

## Mandatory Coding Patterns

Every pattern below is load-bearing. Do not omit any of them.

### 1. Realtime Mutation Tracking

Every mutation in `api/list.ts` that writes to `list_items` **must** wrap its Supabase call with the local mutation counter. This prevents the realtime subscription from triggering a toast for the user's own changes.

```typescript
// At the top of api/list.ts (module-level, already exists)
let localMutationCount = 0;
function incrementLocalMutation() { localMutationCount++; }
function decrementLocalMutation() {
  setTimeout(() => { localMutationCount = Math.max(0, localMutationCount - 1); }, 500);
}

// In every mutationFn that touches list_items:
mutationFn: async (args) => {
  incrementLocalMutation();
  try {
    const { data, error } = await supabase.from('list_items')...;
    if (error) throw error;
    return data;
  } finally {
    decrementLocalMutation();  // always in finally
  }
}
```

### 2. Household Guard

Every mutation that **inserts** into a household-scoped table must throw early if `householdId` is null. Read queries do not need this guard.

```typescript
const { householdId } = useHousehold();

mutationFn: async (args) => {
  if (!householdId) throw new Error('No household ID found');
  // ...insert with household_id: householdId
}
```

Household-scoped tables: `items`, `item_stores`, `list_items`, `shopping_trips`.

### 3. Undo Registration

Every user-initiated mutation on the shopping list screen **must** call `pushAction` after success. This includes adds, deletes, toggles, edits, drag-to-reorder, and end-trip.

```typescript
const { pushAction } = useUndo();

// After awaiting the mutation:
pushAction({
  label: `Added ${name}`,           // shown in UI badge
  undo: async () => { /* inverse Supabase operation */ },
  redo: async () => { /* re-apply the operation */ },
});
```

Use `mutateAsync` (not `mutate`) on screens that need to `pushAction` after the result, since `pushAction` often needs the returned `id`.

### 4. React Query Invalidation

After any mutation, invalidate the relevant query keys:

| Modified table     | Invalidate key(s)                        |
|--------------------|------------------------------------------|
| `list_items`       | `['shopping_list']`                      |
| `items`            | `['items']`, `['all_items']`             |
| `items` + list     | `['items']`, `['all_items']`, `['shopping_list']` |
| `metadata`         | rarely changes — `staleTime: 1hr`        |

### 5. Platform-Specific Dialogs

`Alert.alert` does not work on web. Always check platform before showing native alerts:

```typescript
import { Platform, Alert } from 'react-native';

if (Platform.OS === 'web') {
  if (window.confirm('Are you sure?')) { doAction(); }
} else {
  Alert.alert('Title', 'Message', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: doAction },
  ]);
}
```

### 6. Styling

Use `StyleSheet.create()` only. Do not use NativeWind `className` props.

```typescript
// Correct
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
});
<View style={styles.container} />

// Wrong — do not use
<View className="flex-1 bg-white" />
```

## Supabase Query Patterns

**Read with joins (the standard pattern):**
```typescript
const { data, error } = await supabase
  .from('list_items')
  .select(`
    *,
    store:stores!store_id(name, color_code),
    category:categories!category_id(name, sort_order)
  `)
  .is('archived_at', null)
  .order('added_at', { ascending: false });
```

**The `!foreign_key_name` syntax is required** when a table has multiple FK relationships to the same target table (e.g., `list_items` has both `store_id` and `item_id`).

**Active list items filter:** Always add `.is('archived_at', null)` when querying the current shopping list.

**Household scoping is enforced by RLS** via `get_my_household_id()` — you still must pass `household_id` explicitly on inserts.

## TypeScript Conventions

- Define interfaces for Supabase row shapes in the same `api/` file that uses them (see `ListItem` in `api/list.ts`, `MasterItem` in `api/items.ts`)
- Screen-level components can use `any` for complex nested types when iteration speed matters, but `api/` files should be typed
- Avoid `as unknown as X` casts — use proper select shapes instead

## Data Model Quick Reference

**`list_items`** — the shopping list
- `item_id`: nullable — `null` means one-off item (not in master dictionary)
- `is_purchased` + `archived_at`: drive the three-state lifecycle
- `trip_id`: set when archived (end trip)
- `purchased_by`: set to `auth.uid()` when checked off

**`items`** — master item dictionary (household-scoped)
- Unique on `(name, household_id)`
- `alternate_qtys`: `TEXT[]` — shown as quick-select chips in add flow

**`item_stores`** — many-to-many between `items` and `stores`
- When updating, delete all then re-insert (see `useUpdateMasterItem`)

**Global tables** (no household scoping needed): `stores`, `categories`, `units`

## Testing

### Responsibilities
- Claude provides the **Tests to Write** section in every spec — specific scenarios and assertions
- Gemini implements the tests and is responsible for all tests passing before delivery
- Every new feature or mutation must have corresponding tests

### Running Tests
```bash
cd client
npm test                                          # all tests
npm test -- --testPathPattern=SmartAddItem        # single file
npm test -- --watchAll                            # watch mode
```

### Test File Location
Place tests adjacent to the component or module being tested:
```
components/
  SmartAddItem.tsx
  __tests__/
    SmartAddItem-test.tsx    ← component tests here
api/
  __tests__/
    list-test.ts             ← api/hook tests here
```

### Required Test Wrapper

Components that use `useHousehold()`, `useUndo()`, or any React Query hook require all three providers. The Supabase mock returns a null session, so `householdId` will be null — fine for UI tests, but mutation tests need to mock the household query response explicitly.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UndoProvider } from '@/api/undoContext';
import { HouseholdProvider } from '@/lib/household';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <UndoProvider>
      <HouseholdProvider>{children}</HouseholdProvider>
    </UndoProvider>
  </QueryClientProvider>
);
```

### What to Test

**For every feature, test:**
1. The observable UI behaviors from the spec's Acceptance Criteria
2. Each mandatory pattern that applies to the feature:
   - Household guard: mutation throws when `householdId` is null
   - Undo registration: `pushAction` is called with the correct label after a mutation
   - Realtime tracking: `localMutationCount` is incremented then decremented around mutations

**Pattern test examples:**
```typescript
// Household guard
it('throws when householdId is null', async () => {
  // mock useHousehold to return null
  await expect(mutationFn(args)).rejects.toThrow('No household ID found');
});

// Undo registration
it('registers an undo action after adding an item', async () => {
  const pushAction = jest.fn();
  // mock useUndo to capture pushAction calls
  // trigger the add action
  expect(pushAction).toHaveBeenCalledWith(
    expect.objectContaining({ label: expect.stringContaining('Added') })
  );
});
```

### Mocking Notes

`jest.setup.js` provides global mocks for:
- `@react-native-async-storage/async-storage`
- `@/lib/supabase` (via `./lib/supabase` — resolves to the same path via babel-preset-expo)
- `expo-router`
- `react-native-reanimated`

To override the Supabase mock for a specific test, re-mock inside the test file:
```typescript
import { supabase } from '@/lib/supabase';
jest.mocked(supabase.from).mockReturnValueOnce({
  select: jest.fn().mockReturnThis(),
  // ...chain as needed
} as any);
```

## What Requires a Design Spec Before Implementing

Do not implement the following without a spec from Claude:

- Any new database tables or columns
- Changes to RLS policies or the `get_my_household_id()` function
- New root-level React context providers
- Changes to the undo/redo system behavior
- The trip workflow (end trip, archival logic)
- Multi-user or household membership features
