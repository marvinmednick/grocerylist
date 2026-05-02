# Implementation Plan: F81 Dark Mode Visual Implementation

## Files to Modify

- `client/lib/theme.tsx` —
  1. **Replace the theme provider contract with the exact 3-state preference model** — replace the file with `ThemePreference = 'system' | 'light' | 'dark'`, store `themePreference` under `@app_theme_pref`, compute `isDark` from `themePreference === 'system' ? deviceScheme === 'dark' : themePreference === 'dark'`, expose `setThemePreference(pref: ThemePreference)`, and import `useColorScheme` from `@/components/useColorScheme`.
  2. **Add typed color selection hook** — export `useThemeColors(): { colors: AppColors }` that returns `darkColors` or `lightColors` from `@/constants/Colors` based on resolved `isDark`.
  3. **Ensure:** keep `AppThemeProvider` as the provider boundary used by the app, preserve AsyncStorage-backed persistence behavior on mount, and do not introduce any database sync, undo behavior, or unrelated provider changes.

- `client/constants/Colors.ts` —
  1. **Replace the file with the typed 18-token palette** — define the exact `AppColors` interface and the full `lightColors` / `darkColors` objects from the spec, including `modalOverlay`, `buttonSecondary`, `buttonSecondaryText`, and `star`.
  2. **Retain the legacy default export for tab chrome compatibility** — keep the `default` export shape with `light` and `dark` objects and align `tint` / `tabIconSelected` with `#2563eb` and `#3b82f6`.
  3. **Ensure:** do not change token names, values, or the existing default-export surface beyond aligning it to the new palette.

- `client/app/_layout.tsx` —
  1. **Align React Navigation theming to resolved app theme** — remove `useColorScheme` usage from `RootLayoutNav`, add `const { isDark } = useAppTheme();`, and switch `<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>` to `<ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>`.
  2. **Ensure:** preserve the current provider tree order, navigation structure, and any existing auth/household wiring outside the theme source swap.

- `client/components/Settings.tsx` —
  1. **Replace the binary dark-mode switch UI with the exact Appearance rows** — remove `Switch`, add Lucide `Check`, switch from `const { isDark, toggleTheme } = useAppTheme();` to `const { themePreference, setThemePreference } = useAppTheme();`, and render the App section as three tappable rows with `testID`s `settings-appearance-system`, `settings-appearance-light`, and `settings-appearance-dark`, showing `settings-appearance-check-${pref}` only for the active row and the subtitle `Follows device setting` only on `system`.
  2. **Adopt the shared theme styling pattern in this modal** — add `const { colors } = useThemeColors();`, import `AppColors`, create `const styles = useMemo(() => makeStyles(colors), [colors]);`, convert hardcoded colors to tokens, and add `sectionSubtitle`, `appearanceRow`, and `rowSubtitle` style entries with the exact semantics from the spec.
  3. **Ensure:** keep the existing modal layout, safe-area/ScrollView behavior, section structure outside the App appearance block, and any non-theme settings actions untouched.

- `client/app/(tabs)/_layout.tsx` —
  1. **Use theme colors for tab active tint** — remove `Colors` and `useColorScheme`, add `useThemeColors`, replace `const colorScheme = useColorScheme();` with `const { colors } = useThemeColors();`, and set `tabBarActiveTintColor: colors.primary`.
  2. **Ensure:** keep the current tab definitions, labels, icons, and all non-color screen options unchanged.

- `client/app/(tabs)/index.tsx` —
  1. **Migrate all hardcoded colors to `useThemeColors()`** — apply the `makeStyles(colors: AppColors)` plus `useMemo(() => makeStyles(colors), [colors])` pattern and replace each hardcoded hex with the matching semantic token from the Hex → Token table.
  2. **Ensure:** preserve shopping-list behavior, undo wiring, active-list query/mutation behavior, modal triggers, store/user identity colors, and any fixed warning signal colors.

- `client/app/(tabs)/items.tsx` —
  1. **Migrate all hardcoded colors to `useThemeColors()`** — apply the same `makeStyles(colors)` plus `useMemo` pattern and remap every hardcoded color to the specified token set.
  2. **Ensure:** preserve item-library CRUD behavior, modal flows, save handlers, query/mutation wiring, and any user-chosen or fixed semantic colors that must remain hardcoded.

- `client/app/(tabs)/history.tsx` —
  1. **Migrate all hardcoded colors to `useThemeColors()`** — convert module-scope styles into `makeStyles(colors)` and replace hex values with the matching tokens.
  2. **Ensure:** keep history rendering, date formatting, navigation behavior, and any data-driven colors unchanged.

- `client/components/SmartAddItem.tsx` —
  1. **Apply the component color migration pattern across the full add-item flow** — import `useThemeColors`, `AppColors`, and `useMemo`, convert the module `StyleSheet.create` into `makeStyles(colors)`, and remap the file’s hardcoded colors to semantic tokens.
  2. **Ensure:** preserve parser behavior, dedupe/ranking behavior, add/edit flows, undo registration, and all store/profile identity colors.

- `client/components/StoreSelector.tsx` —
  1. **Apply the component color migration pattern** — switch to `useThemeColors()` and `makeStyles(colors)` and replace hardcoded colors with tokens while leaving any `store.color_code` usage untouched.
  2. **Ensure:** preserve store selection behavior, search/filtering, and user-chosen store color dots exactly as they work today.

- `client/components/Abbreviations.tsx` —
  1. **Apply the component color migration pattern** — move styles behind `makeStyles(colors)` and replace hardcoded colors with theme tokens.
  2. **Ensure:** keep abbreviation CRUD behavior, modal interactions, and existing text/input logic unchanged.

- `client/components/VocabularyManagement.tsx` —
  1. **Apply the component color migration pattern** — use `useThemeColors`, `AppColors`, and `useMemo` so all hardcoded colors are replaced by semantic tokens.
  2. **Ensure:** preserve the existing vocabulary-management flows, modal structure, and non-color behavior.

- `client/components/MultiTripModal.tsx` —
  1. **Apply the component color migration pattern** — convert styles to `makeStyles(colors)` and use tokens for all replaceable colors, including the backdrop via `colors.modalOverlay` where appropriate.
  2. **Ensure:** keep safe-area handling, scrollability, trip-selection behavior, and any modal interaction patterns unchanged.

- `client/components/DuplicateResolutionDialog.tsx` —
  1. **Apply the component color migration pattern** — adopt `useThemeColors`, `AppColors`, and `makeStyles(colors)` for all themeable colors.
  2. **Ensure:** preserve the nested-`Pressable` dialog behavior, resolution actions, and all existing control flow.

- `client/components/WarningBadge.tsx` —
  1. **Apply the component color migration pattern around fixed warning signals** — migrate background/text/border colors that are general UI chrome to tokens, but leave warning icon tint values `#f59e0b`, `#ef4444`, and `#6b7280` hardcoded per spec.
  2. **Ensure:** warning severity semantics and icon colors remain exactly unchanged.

- `client/components/WarningCallout.tsx` —
  1. **Apply the component color migration pattern around warning-specific UI** — move general surfaces/text/borders to tokens while preserving any warning signal colors that the spec marks as fixed.
  2. **Ensure:** retain current warning copy, iconography, and severity signaling behavior.

- `client/components/Toast.tsx` —
  1. **Implement the spec’s special-case toast color logic** — wrap styles in `makeStyles(colors)`, set the default toast to `backgroundColor: colors.textPrimary` with `text.color = colors.background`, and keep the warning variant hardcoded to `backgroundColor: '#fffbeb'`, `borderColor: '#fbbf24'`, and `color: '#92400e'`.
  2. **Ensure:** keep positioning, animation/timing behavior, and variant selection logic unchanged while preserving the fixed amber warning semantics.

- `client/components/SizesAndPackages.tsx` —
  1. **Apply the component color migration pattern** — move style creation behind `makeStyles(colors)` and replace hardcoded colors with tokens.
  2. **Ensure:** preserve parsing/editor behavior and all current interactions.

- `client/components/UserAvatar.tsx` —
  1. **Apply the component color migration pattern while preserving profile identity color** — use theme tokens for surrounding text/surfaces/borders but keep `avatarColor` unchanged because it represents the user profile color.
  2. **Ensure:** avatar identity color, initials rendering, and existing sizing/layout behavior stay intact.

- `client/components/HeaderActions.tsx` —
  1. **Apply the component color migration pattern** — adopt `useThemeColors`, `AppColors`, and `makeStyles(colors)` for the header action chrome.
  2. **Ensure:** keep action buttons, handlers, and layout behavior unchanged.

- `client/app/auth.tsx` —
  1. **Apply the component color migration pattern on the auth screen** — import `useThemeColors`, `AppColors`, and `useMemo`, convert styles to `makeStyles(colors)`, and replace the file’s hardcoded colors with the token palette while relying on `AppThemeProvider` from `_layout.tsx`.
  2. **Ensure:** preserve auth flow behavior, validation, profile creation, and any non-theme logic.

- `client/jest.setup.js` —
  1. **Add the global `./lib/theme` mock for migrated components** — add `AppThemeProvider`, `useAppTheme`, and `useThemeColors` mocks returning the exact light-mode token set and `themePreference: 'light'` / `setThemePreference: jest.fn()`.
  2. **Ensure:** keep the existing AsyncStorage, Supabase, Expo Router, and Reanimated mocks intact so current test setup behavior does not regress.

- `client/components/__tests__/Settings-test.tsx` —
  1. **Update the local theme mock contract** — expand `jest.mock('@/lib/theme', ...)` to include `useThemeColors`, add `const mockUseThemeColors = useThemeColors as jest.Mock;`, change the `useAppTheme` mock to `{ isDark: false, themePreference: 'light', setThemePreference }`, and return all 18 light tokens from `mockUseThemeColors`.
  2. **Replace the switch test with the new appearance-row coverage** — remove `it('toggles dark mode from switch', ...)` and add the exact tests from the spec for the `APPEARANCE` header, the System/Light/Dark rows, the `Follows device setting` subtitle, active-check rendering, `setThemePreference('dark' | 'light' | 'system')`, and absence of `testID="settings-dark-mode-switch"`.
  3. **Ensure:** keep the existing selected-segment assertion that checks `backgroundColor: '#2563eb'` working via `colors.primary`, and do not loosen or remove unrelated settings coverage.

- `BACKLOG.md` —
  1. **Append the exact deferred-items block under `Deferred from Specs`** — add the five unchecked F81 items covering animated crossfade, custom themes, per-component overrides, test color assertion cleanup, and non-color hardcoded value cleanup.
  2. **Ensure:** leave existing backlog organization and unrelated deferred items untouched.

## New Files

- `client/lib/__tests__/theme-test.ts` — new theme-provider test file that covers the exact scenarios from the spec: default `themePreference` of `"system"` when `AsyncStorage.getItem` returns null, `isDark` resolution for system/light and forced light/dark preferences, `AsyncStorage.setItem('@app_theme_pref', pref)` on `setThemePreference`, loading stored `'dark'` on mount, and `useThemeColors()` returning `colors.background === '#ffffff'` when `isDark` is false and `colors.background === '#111827'` when `isDark` is true.

## Patterns Applying
- Realtime Mutation Tracking: No — F81 changes theme infrastructure, UI colors, settings controls, and tests only; it does not add or modify any `list_items` mutation flow.
- Household Guard: No — theme preference is stored per-device in AsyncStorage and the spec explicitly says there are no household-scoped writes.
- Undo Registration: No — the spec explicitly says theme preference changes do not register with the undo stack because they are persistent user preferences rather than list mutations.

## Ambiguities / Questions
- The spec’s `New Files` section says `None`, but the `Tests to Write` section explicitly requires a new file at `client/lib/__tests__/theme-test.ts`; this plan treats that test file as required and assumes `New Files` meant no new production components/migrations.
