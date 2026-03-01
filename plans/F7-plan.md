# Implementation Plan: F7 Settings Screen

## Files to Modify

- `components/UserAvatar.tsx` —
  1. **Settings Modal State + Trigger** — add `settingsVisible` state initialized to `false`; add a new `"Settings"` `TouchableOpacity` menu item in the dropdown above `"Sign Out"`; on press, call `setMenuVisible(false)` then `setSettingsVisible(true)`.
  2. **Settings Modal Render** — import `Settings` and render `<Settings visible={settingsVisible} onClose={() => setSettingsVisible(false)} />` below the existing `<Modal>`.
  3. **Ensure:** existing avatar tap behavior, dropdown open/close behavior, and sign-out flow remain unchanged.

- `app/(tabs)/items.tsx` —
  1. **Header Actions Integration** — import `HeaderActions` from `@/components/HeaderActions`.
  2. **Title Row Layout** — update the `titleRow` to include `HeaderActions` on the right side while keeping the existing plus button; final visual order must be `[Title] [+ button] [HeaderActions]`, with HeaderActions to the right of plus.
  3. **Ensure:** plus button behavior, item creation flow, and existing list/filter interactions remain unchanged.

- `app/(tabs)/history.tsx` —
  1. **Header Actions Integration** — import `HeaderActions` from `@/components/HeaderActions`.
  2. **Screen Header Layout Update** — update `screenHeader` (currently title-only) to include `<HeaderActions />` on the right and set layout to `flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`.
  3. **Ensure:** history data fetching/rendering and existing history interactions remain unchanged.

- `app/_layout.tsx` —
  1. **Theme Provider Wiring** — import `AppThemeProvider` from `@/lib/theme`.
  2. **Provider Tree Wrap** — wrap existing providers inside `<AppThemeProvider>` directly under `<GestureHandlerRootView>`:
     `GestureHandlerRootView > AppThemeProvider > QueryClientProvider > UndoProvider > RootLayoutNav`.
  3. **Ensure:** keep existing `ThemeProvider` import from `@react-navigation/native` intact with no rename/conflict, and preserve current navigation/provider behavior.

- `components/__tests__/UserAvatar-test.tsx` —
  1. **Settings Menu Presence Test** — add test that opening avatar dropdown shows `"Settings"`.
  2. **Settings Modal Open Test** — add test that tapping `"Settings"` opens the Settings modal.
  3. **Ensure:** existing avatar/sign-out tests remain valid and unchanged in intent.

- `app/(tabs)/__tests__/history-test.tsx` —
  1. **HeaderActions Render Test** — add test asserting History header renders undo button, redo button, and avatar from `HeaderActions`.
  2. **Ensure:** existing history screen test coverage/expectations remain intact.

## New Files

- `components/Settings.tsx` — full-screen slide-up modal component with props `{ visible: boolean; onClose: () => void }`; implement sections:
  1. **Header:** `"Settings"` title + top-right `TouchableOpacity` with lucide `X` icon size `22`; tapping X calls `onClose`.
  2. **Profile section:** pre-filled `TextInput` for display name and short name (from household/profile context), 7-color horizontal picker using `PROFILE_COLORS`, selected circle style `borderWidth: 2`, `borderColor: 'white'`, unselected `borderColor: 'transparent'`; show `"Another member uses this color"` warning (`color: '#991b1b'`) only when selected color exists in `memberColors` from `useHouseholdMemberColors`; Save button calls `useUpdateProfile().mutate({ display_name, display_name_short, color })`.
  3. **App section:** Dark Mode row with `Switch` using `value={isDark}` and `onValueChange={toggleTheme}` for immediate persistence.
  4. **Household section:** read-only household name text from `useHouseholdName(householdId)` with `ActivityIndicator` while loading.
  5. **Constant:** define exact `PROFILE_COLORS` list with Blue `#2563eb`, Green `#16a34a`, Orange `#ea580c`, Purple `#9333ea`, Red `#dc2626`, Teal `#0d9488`, Pink `#db2777`.

- `components/HeaderActions.tsx` — shared header row component using `useUndo()` with `{ undoLastAction, redoLastAction, canUndo, canRedo, undoStack, redoStack }`; render undo button (`RotateCcw`), redo button (`RotateCw`), and `UserAvatar` with exact Shopping List header styling:
  1. Button wrapper style `padding: 8`, `backgroundColor: '#eff6ff'`, `borderRadius: 12`, `position: 'relative'`.
  2. Undo icon color `canUndo ? '#2563eb' : '#9ca3af'`, redo icon color `canRedo ? '#2563eb' : '#9ca3af'`.
  3. Disabled button wrapper opacity `0.3` when unavailable.
  4. Undo badge when `undoStack.length > 0`: `top: -4`, `right: -4`, `borderRadius: 10`, `width: 18`, `height: 18`, `backgroundColor: '#ef4444'`, `borderWidth: 2`, `borderColor: 'white'`; text `color: 'white'`, `fontSize: 9`, `fontWeight: '800'`.
  5. Redo badge same geometry/text style with `backgroundColor: '#10b981'`.
  6. Spacing `marginLeft: 12` between elements; `UserAvatar` also `marginLeft: 12`.

- `api/profile.ts` — add three hooks with exact Supabase/query-key behavior:
  1. `useUpdateProfile` mutation:
     - payload `{ display_name, display_name_short, color }`
     - get session via `supabase.auth.getSession()`, throw `'Not authenticated'` if missing
     - exact update chain:
       `supabase.from('profiles').update({ display_name, display_name_short, color }).eq('id', session.user.id)`
     - on success invalidate `queryClient.invalidateQueries({ queryKey: ['my_profile'] })`
  2. `useHouseholdName(householdId)` query:
     - query key `['household_name', householdId]`
     - exact query:
       `supabase.from('households').select('name').eq('id', householdId!).single()`
     - return `data.name as string`
     - `enabled: !!householdId`
  3. `useHouseholdMemberColors(householdId)` query:
     - query key `['household_member_colors', householdId]`
     - get session; if no session or no householdId return `[]`
     - exact query:
       `supabase.from('profiles').select('color').eq('household_id', householdId).neq('id', session.user.id)`
     - return `(data ?? []).map(p => p.color).filter(Boolean) as string[]`
     - `enabled: !!householdId`

- `lib/theme.tsx` — AsyncStorage-backed theme context with:
  1. `AppThemeContextType` exact shape `{ isDark: boolean; toggleTheme: () => void; }`.
  2. `AppThemeProvider` reads `AsyncStorage.getItem('@app_theme')` on mount; set `isDark` true only for `'dark'`; null/unset defaults to `false`.
  3. `toggleTheme` flips state and writes `'dark'`/`'light'` to `AsyncStorage.setItem('@app_theme', newValue)`.
  4. `useAppTheme()` hook returns context and throws when used outside provider.

- `components/__tests__/Settings-test.tsx` — add tests for all spec scenarios:
  1. display name input pre-filled from profile (`displayName='Alice'`)
  2. short name input pre-filled (`displayNameShort='Ali'`)
  3. renders exactly 7 color circles
  4. selecting a circle updates white-ring selection and clears previous selection
  5. warning appears when selected color is in member colors (`'Another member uses this color'`)
  6. warning absent when selected color not in member colors
  7. Save Changes calls `mutate` with `{ display_name, display_name_short, color }`
  8. Dark mode switch triggers `toggleTheme`
  9. X button calls `onClose`
  10. household name from `useHouseholdName` is rendered (`'The Smiths'`)
  Include required test providers (`QueryClientProvider` + `UndoProvider` + `HouseholdProvider`) and `SafeAreaProvider`.

- `components/__tests__/HeaderActions-test.tsx` — add tests for:
  1. undo button render
  2. redo button render
  3. avatar render
  4. undo opacity `0.3` when `canUndo=false`
  5. redo opacity `0.3` when `canRedo=false`
  6. undo press calls `undoLastAction`
  7. redo press calls `redoLastAction`
  8. undo badge count shown for non-empty undo stack (e.g., `'2'`)
  9. redo badge count shown for non-empty redo stack (e.g., `'1'`)

- `api/__tests__/profile-test.ts` — add hook tests for:
  1. `useUpdateProfile` sends exact `profiles` update payload
  2. `useUpdateProfile` invalidates `{ queryKey: ['my_profile'] }` on success
  3. `useHouseholdName` returns household name from `households`
  4. `useHouseholdMemberColors` returns other member colors list
  5. `useHouseholdMemberColors` disabled/no query when `householdId=null`

- `lib/__tests__/theme-test.tsx` — add theme-context tests for:
  1. default `isDark=false` when AsyncStorage returns `null`
  2. `isDark=true` when storage value is `'dark'`
  3. `toggleTheme` writes `('@app_theme', 'dark')` when starting from light
  4. `toggleTheme` writes `('@app_theme', 'light')` when starting from dark

- `app/(tabs)/__tests__/items-test.tsx` — new minimal screen test asserting Items header renders undo button, redo button, and avatar via `HeaderActions`.

- `supabase/migrations/[timestamp]-description.sql` — none required for F7 (no database/schema changes).

## Patterns Applying
- Realtime Mutation Tracking: No — feature does not write to `list_items`; spec explicitly says not applicable.
- Household Guard: No — no household-scoped inserts; profile update is self-update by `session.user.id`; read hooks are query-only with `enabled: !!householdId`.
- Undo Registration: No — spec explicitly says settings/profile changes are not undoable and must not call `pushAction`.

## Ambiguities / Questions
- None.
