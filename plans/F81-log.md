# F81 Feature Log

## 2026-04-30 — Specced

- **Spec:** `specs/F81-dark-mode.md`
- **GitHub Issue:** #81
- **Review Level:** Full
- **Scope:** Full light/dark mode migration — expand `lib/theme.tsx` to 3-state preference (system/light/dark), define complete `AppColors` palette in `constants/Colors.ts`, fix `ThemeProvider` alignment in `_layout.tsx`, replace Settings Switch with 3-row Appearance section, and apply `makeStyles(colors) + useMemo` pattern to all ~16 screens and components.
- **Closes on ship:** #81

## 2026-04-30 — Designed

- Design doc created: `docs/design/F81-dark-mode.md`
- Key decisions: 3-state AsyncStorage preference, `useThemeColors()` hook, `makeStyles(colors)` component pattern, 18-token palette, Appearance section replaces binary Switch.
- Implementation split into 5 ordered batches; feature not Done until all complete.
