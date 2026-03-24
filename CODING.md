# CODING.md

Coding conventions and patterns for this repository. Read by all implementation agents (Gemini, aider, etc.) before writing code.

For behavioral rules and workflow discipline, see `AGENT.md`.

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

Household-scoped tables: `items`, `item_store_preferences`, `list_items`, `shopping_trips`, `stores`.

### 3. Undo Registration

Every user-initiated mutation on the shopping list screen **must** call `pushAction` after success. This includes adds, deletes, toggles, edits, drag-to-reorder, and end trip.

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

#### Two failure modes — both cause silent data corruption

**Failure mode A — Stale row ID after redo**

When redo re-inserts a deleted row or re-creates an ended trip, Supabase assigns a *new* ID. A closure over the original ID will target a deleted or wrong row on the next undo.

Fix: **mutable tracker pattern** — update the tracked ID inside the redo closure:

```typescript
const tracker = { currentId: result.id };
pushAction({
  label: `Added ${name}`,
  undo: async () => { await deleteItem(tracker.currentId); },
  redo: async () => {
    const r = await forwardAction();
    tracker.currentId = r.id;  // update so the next undo targets the new row
  },
});
```

**Failure mode B — Missing field capture**

When undo needs to restore a field that the mutation overwrites (e.g., `purchased_by`, `store_id`), that field must be captured from the item *before* the mutation fires. Reading it inside the undo closure reads stale React state.

For mutations that overwrite **one or two well-known fields**, capture them individually before the mutation:

```typescript
const originalPurchasedBy = item.purchased_by;  // capture before mutation
await togglePurchased({ id: item.id, is_purchased: true });
pushAction({
  undo: async () => {
    await togglePurchased({
      id: item.id,
      is_purchased: false,
      purchased_by_override: originalPurchasedBy,
    });
  },
  ...
});
```

For mutations that overwrite **multiple fields at once** (e.g., editing name + qty + store together), snapshot the entire relevant portion of the row to avoid accidentally omitting a field:

```typescript
const snapshot = { name: item.name, quantity: item.quantity, store_id: item.store_id };
await updateItem({ id: item.id, name: editName, quantity: editQty, store_id: editStoreId });
pushAction({
  undo: async () => { await updateItem({ id: item.id, ...snapshot }); },
  redo: async () => { await updateItem({ id: item.id, name: editName, quantity: editQty, store_id: editStoreId }); },
  ...
});
```

#### Checklist before registering any pushAction

1. Does redo create a new row (new ID)? → use mutable tracker
2. Does the mutation overwrite any field that undo needs to restore? → capture it before the mutation
3. Are multiple fields being overwritten? → snapshot the entire relevant portion of the row

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

**Safe area:** Use `useSafeAreaInsets` from `react-native-safe-area-context` to apply insets manually (e.g., `paddingTop: insets.top` on a header). Do not use the built-in `SafeAreaView` from `react-native` — it is deprecated and triggers warnings in tests. If you do use `SafeAreaView`, import it from `react-native-safe-area-context`. Tests that render components using either require a `SafeAreaProvider` wrapper (see `index-interactions-test.tsx` for the pattern).

```typescript
// Correct
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
});
<View style={styles.container} />

// Wrong — do not use
<View className="flex-1 bg-white" />
```

### 7. Modal / Full-Screen View Requirements

Every modal and full-screen view **must** follow these rules:

1. **Safe area insets:** Apply `useSafeAreaInsets()` from `react-native-safe-area-context` to the outermost content container. At minimum, apply `paddingTop: insets.top` to prevent content from sliding under the notch/Dynamic Island/status bar. Apply `paddingBottom: insets.bottom` when action buttons sit at the bottom edge.

2. **Scrollable content:** Wrap modal body content in a `ScrollView`. Even if content fits on the current screen, it may grow (e.g., more stores added, more preferences). Always include `keyboardShouldPersistTaps="handled"` when the modal contains `TextInput` fields.

3. **Style split for ScrollView modals:** When replacing a `View` wrapper with `ScrollView`, split the style into a container style (on `style`) for layout properties like `borderRadius` and `maxHeight`, and a content style (on `contentContainerStyle`) for padding. This prevents ScrollView from collapsing its layout.

**Reference implementation:** `components/Settings.tsx` — uses `ScrollView` with `keyboardShouldPersistTaps="handled"`, applies `paddingTop: insets.top` via `contentContainerStyle`.

**Common mistake:** Using a plain `View` for modal content with fixed `paddingBottom` instead of safe area insets. This works on some devices but clips content or overlaps the status bar on others.

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

**`item_store_preferences`** — many-to-many between `items` and `stores` (household-scoped)
- `status`: `preferred` | `avoided` | `unavailable` | `neutral`
- `comment`: optional text note per store association
- When updating preferences, delete affected rows then re-insert (see `useUpdateMasterItem`)

**Global tables** (no household scoping needed): `categories`, `units`
**Household-scoped** (requires `household_id`): `items`, `item_store_preferences`, `list_items`, `shopping_trips`, `stores`

## Testing

### Responsibilities
- Claude provides the **Tests to Write** section in every spec — specific scenarios and assertions
- The implementor writes the tests and is responsible for all tests passing before delivery
- Every new feature or mutation must have corresponding tests

### Running Tests
```bash
cd client
npm test                                          # all tests
npm test -- --testPathPattern=SmartAddItem        # single file
npm test -- --watchAll                            # watch mode
npm test -- --runInBand --detectOpenHandles       # diagnose async leaks / worker exit warnings
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

**Always create `QueryClient` per-test inside `beforeEach` and clear it in `afterEach`.** A module-level singleton leaks async state between tests (TanStack Query's `notifyManager` fires state updates after the assertion phase, which the `console.error` fail policy turns into hard failures).

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UndoProvider } from '@/api/undoContext';
import { HouseholdProvider } from '@/lib/household';

describe('MyComponent', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <UndoProvider>
        <HouseholdProvider>{children}</HouseholdProvider>
      </UndoProvider>
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  // ...tests
});
```

If you see `"worker process has failed to exit gracefully"` after a test run, the most common cause is a React Query GC timer left open. Ensure all test `QueryClient` instances use `gcTime: Infinity` (prevents GC timers from being scheduled). Run with `--runInBand --detectOpenHandles` to pinpoint other leak sources.

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

// Locale/timezone-sensitive values (dates, formatted numbers)
// Compute the expected string the same way the component does — never hardcode locale output.
// This is self-consistent across CI environments with different locale settings.
it('displays the formatted end date', () => {
  const ended_at = '2025-01-15T20:00:00.000Z';
  // render component with ended_at above
  expect(screen.getByText(new Date(ended_at).toLocaleDateString())).toBeTruthy();
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
