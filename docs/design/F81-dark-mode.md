# Design: Dark Mode Visual Implementation
<!-- ID: F81 | Status: Designed -->

## Overview

Implements full light/dark mode support across all app screens and components. The infrastructure (`AppThemeProvider`, Settings toggle, `constants/Colors.ts` token slots) is already scaffolded, but every component uses hardcoded hex values that ignore the theme. This feature replaces all hardcoded colors with calls to a `useThemeColors()` hook, defines a complete dark palette, and upgrades the Settings toggle from a binary switch to a 3-state preference (System / Light / Dark).

## User Scenarios

User opens Settings and sets Appearance to "Dark". All screens — shopping list, items, history, modals, auth — immediately render with dark backgrounds and light text. On subsequent sessions, the preference is restored from device storage. When set to "System", the app follows the device's current dark/light setting automatically without requiring explicit user action.

## Design Decisions

### Theme preference: 3-state (system / light / dark)

**Decision:** `themePreference: 'system' | 'light' | 'dark'` stored in AsyncStorage (key `@app_theme_pref`). Resolved `isDark` is computed at runtime: preference `'system'` defers to `useColorScheme()` device value; `'light'` and `'dark'` override it unconditionally. `AppThemeProvider` exposes both `themePreference` (stored) and `isDark` (resolved).

**Rationale:** Users expect to force a mode independent of the device setting. "System" as default matches modern app expectations.

**Alternatives considered:** Binary toggle (current) — can't represent "follow system". System-only — removes user override.

---

### Per-device preference storage

**Decision:** AsyncStorage only; not synced to `profiles` table.

**Rationale:** Display mode is often device-specific (phone = dark, desktop = light). Syncing adds network dependency at startup for a non-collaborative preference.

---

### `useThemeColors()` hook as color source of truth

**Decision:** Add `useThemeColors(): { colors: AppColors }` to `lib/theme.tsx`. Components use this hook to get a typed color object. Structural styles remain in `StyleSheet.create()` but all color values come from the hook.

**Component pattern:**
```typescript
// Module scope — pure function, called with colors at render time
const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title:     { color: colors.textPrimary, fontSize: 16 },
});

export function MyComponent() {
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // ...
}
```

**Rationale:** Style definitions remain readable and co-located. `useMemo` ensures recomputation only on theme change (not every render). Avoids module-scope hook-call issues. Scales cleanly across all components.

**Alternatives considered:** Separate `lightStyles` / `darkStyles` per component — doubles style code. Inline color overrides — mixes structural and color concerns.

---

### `_layout.tsx` ThemeProvider alignment

**Decision:** `RootLayoutNav` must read resolved `isDark` from `useAppTheme()` (not raw `useColorScheme()`) when constructing the value passed to `ThemeProvider`. This keeps navigation chrome (tab bar, nav header backgrounds) in sync with the app theme.

**Rationale:** Currently both `useColorScheme()` (device) and `AppThemeProvider` (custom) are active in `_layout.tsx` and can disagree when the user has forced a mode. Aligning them eliminates this inconsistency.

---

### Settings "Appearance" UI — 3 radio rows

**Decision:** Replace the `Dark Mode` Switch row with a section labeled "APPEARANCE" containing three tappable rows: System, Light, Dark. The active selection shows a Lucide `Check` icon on the right. The System row includes a subtitle line: "Follows device setting".

**Rationale:** Three states can't be expressed by a binary Switch. Tappable rows with checkmarks are an established pattern in this app (store preference rows, settings sections). No new component type needed.

**Alternatives considered:** Segmented control — more compact but novel component type. Dropdown — unnecessary weight for 3 options.

---

### Data-driven colors unchanged in dark mode

**Decision:** Store color dots (`stores.color_code`) and profile identity colors (`profiles.color`) render unchanged in both light and dark modes.

**Rationale:** These are user-chosen chromatic signals. They read legibly on both light and dark backgrounds and carry user-established identity/organizational meaning that must not change.

---

### No undo for theme preference

**Decision:** Theme preference changes do not register on the undo stack.

**Rationale:** It's a persistent user preference, not a list mutation. Users toggle back if the result is unwanted.

---

### Color palette

**Decision:** Expand `constants/Colors.ts` with a typed `AppColors` interface and named semantic token set. `useThemeColors()` returns the light or dark object based on resolved `isDark`.

| Token | Light | Dark |
|-------|-------|------|
| `textPrimary` | `#111827` gray-900 | `#f9fafb` gray-50 |
| `textSecondary` | `#374151` gray-700 | `#d1d5db` gray-300 |
| `textMuted` | `#6b7280` gray-500 | `#9ca3af` gray-400 |
| `textDisabled` | `#9ca3af` gray-400 | `#4b5563` gray-600 |
| `background` | `#ffffff` | `#111827` gray-900 |
| `surface` | `#ffffff` | `#1f2937` gray-800 |
| `surfaceRaised` | `#f3f4f6` gray-100 | `#374151` gray-700 |
| `border` | `#e5e7eb` gray-200 | `#374151` gray-700 |
| `primary` | `#2563eb` blue-600 | `#3b82f6` blue-500 |
| `primaryForeground` | `#ffffff` | `#ffffff` |
| `destructiveText` | `#991b1b` red-800 | `#fca5a5` red-300 |
| `destructiveSurface` | `#fee2e2` red-100 | `#450a0a` red-950 |
| `successText` | `#166534` green-800 | `#86efac` green-300 |
| `buttonSecondary` | `#e5e7eb` gray-200 | `#374151` gray-700 |
| `buttonSecondaryText` | `#374151` gray-700 | `#d1d5db` gray-300 |
| `inputBorder` | `#d1d5db` gray-300 | `#4b5563` gray-600 |
| `modalOverlay` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.7)` |
| `star` | `#fbbf24` amber-400 | `#fbbf24` amber-400 |

Token usage guide:
- `background` — main screen background (screen-level `View`)
- `surface` — modal bodies, input backgrounds, list item rows, card backgrounds
- `surfaceRaised` — section headers, chip rows, group containers, badge pill backgrounds
- `border` — dividers, input borders, separator lines
- `inputBorder` — text input border specifically (slightly darker than general border in light mode)
- `destructiveSurface` — red icon pill background in modal headers (trash button)
- `star` — default store indicator (amber star icon); unchanged across modes

Warning/semantic badge colors (amber-500, red-500, gray-500 from ui-guidelines.md §2 Semantic Colors) are **not in this token set** — they are fixed signal colors that must not shift with the theme.

---

### Implementation batching

**Decision:** Implementation can be delivered in batches. The feature is not Done until all batches are complete and every screen renders correctly in both modes.

**Suggested batch order:**
1. **Infrastructure** — `lib/theme.tsx` (3-state preference + `useThemeColors()`), `constants/Colors.ts` (full palette + `AppColors` type), `app/_layout.tsx` (ThemeProvider fix)
2. **Settings** — `components/Settings.tsx` (replace Switch with radio rows)
3. **Main screens** — `app/(tabs)/index.tsx`, `app/(tabs)/items.tsx`, `app/(tabs)/history.tsx`, `app/(tabs)/_layout.tsx`
4. **Components** — `SmartAddItem.tsx`, `StoreSelector.tsx`, `UserAvatar.tsx`, `HeaderActions.tsx`, `MultiTripModal.tsx`, `DuplicateResolutionDialog.tsx`, `WarningBadge.tsx`, `WarningCallout.tsx`, `Toast.tsx`, `SizesAndPackages.tsx`, `VocabularyManagement.tsx`, `Abbreviations.tsx`
5. **Auth** — `app/auth.tsx`

Batches 1 and 2 can be a single PR (infrastructure + visible Settings change). Batches 3–5 are separate PRs that can be reviewed independently. Each batch must leave the app in a working state.

---

## Out of Scope

- **Animated crossfade** between light/dark transitions — instant switch is acceptable for V1; BACKLOG candidate
- **Custom color themes** beyond light/dark — not a current requirement
- **Per-component or per-screen theme override** — not needed
- **Updating test file hardcoded color assertions** — tests can reference color constants once they exist; not required for feature completion
- **Consolidating non-color-related hardcoded values** — separate cleanup concern

## Open Questions

None — ready for `/spec`.
