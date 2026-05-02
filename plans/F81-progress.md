## Progress Log

### Files
- ✅ `client/lib/theme.tsx` — replaced the binary toggle with persisted `system | light | dark` preference handling and added `useThemeColors()` for typed palette access
- ✅ `client/constants/Colors.ts` — replaced the scaffold colors file with the typed 18-token light/dark palette and preserved the legacy default export for tab chrome
- ✅ `client/app/_layout.tsx` — aligned the navigation ThemeProvider with `useAppTheme().isDark` so forced app theme and navigation chrome stay in sync
- ✅ `client/components/Settings.tsx` — replaced the dark-mode switch with the System/Light/Dark appearance rows and migrated the modal chrome to theme tokens
- ✅ `client/app/(tabs)/_layout.tsx` — switched tab active tinting from scaffold colors to `useThemeColors().colors.primary`
- ✅ `client/app/(tabs)/index.tsx` — migrated shopping-list screen chrome, edit modal, and inline action colors to theme tokens while preserving undo and list behaviors
- ✅ `client/app/(tabs)/items.tsx` — migrated the items screen and master-item modal to `useThemeColors()` without changing alias, category, or store-preference flows
- ✅ `client/app/(tabs)/history.tsx` — migrated the history screen and trip modal to the shared theme color tokens without changing trip rendering or navigation
- ✅ `client/components/SmartAddItem.tsx` — migrated the add-item search, dropdown, and edit modal chrome to theme tokens while preserving parser and duplicate-handling behavior
- ✅ `client/components/StoreSelector.tsx` — migrated dropdown and store create/edit modals to theme tokens while preserving store color dots and cascade warnings
- ✅ `client/components/Abbreviations.tsx` — migrated the abbreviations screen and dialog chrome to theme tokens while preserving alias warnings and validation flows
- ✅ `client/components/VocabularyManagement.tsx` — migrated vocabulary list/dialog chrome to theme tokens without changing add/edit/delete/reset behavior
- ✅ `client/components/MultiTripModal.tsx` — migrated the trip-selection modal chrome and controls to theme tokens while preserving user identity colors
- ✅ `client/components/DuplicateResolutionDialog.tsx` — migrated the duplicate-resolution sheet to themed surfaces, text, and inputs without changing duplicate handling flow
- ✅ `client/components/WarningBadge.tsx` — themed the warning modal chrome while preserving the fixed warning icon colors
- ✅ `client/components/WarningCallout.tsx` — moved the callout container and text onto themed surfaces while keeping the warning icons unchanged
- ✅ `client/components/Toast.tsx` — implemented the specified inverted default toast colors and preserved the fixed amber warning variant
- ✅ `client/components/SizesAndPackages.tsx` — migrated the sizes/packages navigation screen to theme colors
- ✅ `client/components/UserAvatar.tsx` — themed the avatar menu chrome while preserving the profile avatar identity color
- ✅ `client/components/HeaderActions.tsx` — migrated header action chrome and icon tinting to theme tokens
- ✅ `client/app/auth.tsx` — migrated the auth card and form chrome to theme tokens while preserving signup/signin and household seeding logic
- ✅ `client/jest.setup.js` — added the global light-theme mock surface so migrated component tests can call `useThemeColors()` safely
- ✅ `client/components/__tests__/Settings-test.tsx` — updated the theme mock contract and replaced the switch coverage with appearance-row tests
- ✅ `client/lib/__tests__/theme-test.tsx` — added provider tests for persisted preference loading, resolved dark-mode behavior, and `useThemeColors()`

### Issues
- None

### Status
Complete
