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

### 4. Optimistic Updates

Use optimistic cache updates for mutations where the user watches the target element for immediate feedback — toggles, inline edits, drag-to-reorder. Skip them when UI transitions mask the latency (modal closes, input clears, undo animation plays).

The full pattern: snapshot previous cache in `onMutate`, update the cache optimistically, roll back in `onError`, and invalidate in `onSettled` (not `onSuccess`) to resync with server truth regardless of outcome.

```typescript
useMutation({
  mutationFn: async (vars) => {
    // server call — no .select().single() needed when cache is already updated
  },
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: ['shopping_list'] });
    const previous = queryClient.getQueryData<ListItem[]>(['shopping_list']);
    queryClient.setQueryData<ListItem[]>(['shopping_list'], (old) =>
      old?.map((item) => item.id === vars.id ? { ...item, ...changes } : item)
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      queryClient.setQueryData(['shopping_list'], context.previous);
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
  },
});
```

### 5. React Query Invalidation

After any mutation, invalidate the relevant query keys:

| Modified table     | Invalidate key(s)                        |
|--------------------|------------------------------------------|
| `list_items`       | `['shopping_list']`                      |
| `items`            | `['items']`, `['all_items']`             |
| `items` + list     | `['items']`, `['all_items']`, `['shopping_list']` |
| `metadata`         | rarely changes — `staleTime: 1hr`        |

### 6. Platform-Specific Dialogs

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

### 7. Styling

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

### 8. Modal / Full-Screen View Requirements

Every modal and full-screen view **must** follow these rules:

1. **Safe area insets:** Apply `useSafeAreaInsets()` from `react-native-safe-area-context` to the outermost content container. At minimum, apply `paddingTop: insets.top` to prevent content from sliding under the notch/Dynamic Island/status bar. Apply `paddingBottom: insets.bottom` when action buttons sit at the bottom edge.

2. **Scrollable content:** Wrap modal body content in a `ScrollView`. Even if content fits on the current screen, it may grow (e.g., more stores added, more preferences). Always include `keyboardShouldPersistTaps="handled"` when the modal contains `TextInput` fields.

3. **Style split for ScrollView modals:** When replacing a `View` wrapper with `ScrollView`, split the style into a container style (on `style`) for layout properties like `borderRadius` and `maxHeight`, and a content style (on `contentContainerStyle`) for padding. This prevents ScrollView from collapsing its layout.

**Reference implementation:** `components/Settings.tsx` — uses `ScrollView` with `keyboardShouldPersistTaps="handled"`, applies `paddingTop: insets.top` via `contentContainerStyle`.

4. **Center/overlay dialogs with a tappable backdrop:** Use nested `Pressable` elements — outer backdrop closes on press, inner card stops propagation. Use a plain `View` for the card and tap-through is possible; items from a parent `Pressable` bubble up unexpectedly.

```tsx
<Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
  <Pressable style={styles.backdrop} onPress={onClose}>
    <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
      {/* card content */}
    </Pressable>
  </Pressable>
</Modal>
```

This applies to any `transparent` modal with a dimmed backdrop (e.g., alert dialogs, detail popovers). Slide-up form modals that fill the screen do not need it.

**Common mistake:** Using a plain `View` for modal content with fixed `paddingBottom` instead of safe area insets. This works on some devices but clips content or overlaps the status bar on others.

5. **No stacked native modals:** iOS silently drops a second `<Modal>` presented while one is visible. Close the first modal before opening the second; use a resume flag to restore it on return. See `ui-guidelines.md` §7d.

6. **Flush pending sub-inputs on Save:** Modal forms with inline sub-inputs (alias chips, tag editors) must commit pending input at the top of `handleSave` before building the payload. `onBlur` handlers must not destructively clear uncommitted user input — hide the input UI if needed, but preserve the value for the save path to consume. See `ui-guidelines.md` §7e.

7. **Dirty-state Save for edit modals:** Edit modals must disable Save until the form diverges from its initial state. Snapshot form state on open, compare via `JSON.stringify` of normalized fields, derive `canSave` with `useMemo`. Add/create modals use form-validity checks instead. See `ui-guidelines.md` §7f for the full pattern.

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

**Test file naming:** Name test files after the topic they cover, not the feature that created them. Use `[module]-[topic]-test.tsx` (e.g. `SmartAddItem-store-test.tsx`, `list-entry-mutations-test.tsx`). Never embed a feature number in a test filename (e.g. `list-f104-test.tsx`) — feature numbers become meaningless as later features add tests to the same file. When a new feature needs tests in an existing module, add them to the relevant existing file or create a new topic-named file.

**`describe` block labels:** Match the file topic, not the feature number. Write `describe('list entry mutation hooks', ...)` not `describe('list F104 hooks', ...)`.

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

### Timer Hygiene

Tests that use `jest.useFakeTimers()` must follow these rules to prevent cross-test leaks:

1. **Always call `jest.useRealTimers()` in `afterEach`** — not just inline at the end of the test. If the test throws before inline cleanup, fake timers leak to all subsequent tests.

```typescript
afterEach(() => {
  jest.useRealTimers();
});
```

2. **Module-level `setTimeout` state (`localMutationCount`)** — `api/list.ts` uses `setTimeout(500ms)` in `decrementLocalMutation()`. Tests that call real mutation functions (not mocked ones) increment this counter, and the decrement only fires 500ms later. If subsequent tests check `localMutationCount === 0` before the timer fires, they see stale state. Use `__resetLocalMutationCount()` (exported from `api/list.ts`) in `beforeEach` when testing realtime behavior that depends on the counter being zero.

3. **Never use `it.skip` or hardcoded sleeps as workarounds.** If a test needs a delay to pass, the root cause is leaked state — fix the leak.

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

### Test Granularity

**One logical scenario per `it()` block.** Each distinct input/output pair or behavioral case gets its own test. Multiple `expect()` calls within a block are fine when they assert different facets of the *same* scenario (e.g., checking both `count` and `packageType` from one parse result), but distinct inputs should be separate tests.

```typescript
// Good: separate scenarios, clear failure diagnostics
it('converts "two milk" → "2 milk"', () => { ... });
it('converts "half pound" → "0.5 pound"', () => { ... });
it('converts "dozen eggs" → "12 eggs"', () => { ... });

// Bad: multiple unrelated scenarios in one block
it('normalizes basic number words', () => {
  expect(normalize('two milk')).toBe('2 milk');
  expect(normalize('half pound')).toBe('0.5 pound');  // if this fails, test name doesn't help
  expect(normalize('dozen eggs')).toBe('12 eggs');
});
```

**Why:** When a test fails in CI, the `it()` description is the first thing you see. Specific descriptions eliminate triage time.

### Composition Scenario Tests

Features that touch the **input-to-match pipeline** (parser, alias expansion, prefix fallback, SmartAddItem merge/dedup/ranking) must include composition scenario tests in addition to unit tests. These verify that multiple systems work correctly together — the integration seams where bugs hide even when individual pieces pass.

**When to write them:** Any feature that modifies or extends the parser, alias system, prefix fallback, or SmartAddItem's interpretation merging logic.

**Pattern:** Use `SmartAddItem-parser-test.tsx` as the reference — render SmartAddItem with real parser (no spy/mock on parser), mock only the data hooks, and assert user-visible results:

```typescript
// Good: tests composition of alias expansion + prefix fallback + dedup
it('deduplicates alias-expanded parser match with prefix fallback match', async () => {
  // Setup: word aliases + master items with aliases
  // Type abbreviated input
  // Assert: item appears exactly once, not duplicated
});
```

**What NOT to duplicate:** Don't re-test pure parser logic (covered in `parser-test.ts` / `parser-alias-test.ts`) or pure component rendering (covered in component tests). Focus on cases where **multiple systems interact**: alias expansion + ranking, alias + quantity + store hint composition, parser/fallback dedup with aliases.

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
