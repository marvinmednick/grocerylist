# Design: Settings Screen
<!-- ID: F7 | Status: Designed -->

## Overview

Adds a Settings screen accessible from the user avatar dropdown, allowing users to edit their profile (display name, short name, color) and toggle dark mode. Also extends the shared app header — UserAvatar plus undo/redo controls — to the Items and History tabs, so every screen has consistent identity and action access.

## User Scenarios

- **Scenario 13 (Sign Out):** Sign Out stays in the avatar dropdown. Settings is a second option in the same dropdown, opening the full Settings modal.
- **(New) Profile customization:** After signup, a user wants to update their display name or choose a different profile color — e.g., after the household fills up and their auto-assigned color conflicts with a partner's.
- **(New) Dark mode preference:** User prefers dark mode on their device and wants the app to respect that preference explicitly.

## Design Decisions

### Settings entry point

**Decision:** The avatar dropdown gets a "Settings" item above "Sign Out". Tapping it closes the dropdown and opens a full-screen Settings modal (slide-up animation, close button top-right). Sign Out remains in the dropdown as-is.

**Rationale:** Keeps the dropdown lightweight (two items). Settings is accessed occasionally, so a full tab slot is not warranted. The full-screen modal matches the History detail modal pattern and gives enough room for form fields and sections.

**Alternatives considered:** Dedicated Settings tab — rejected (wastes a tab slot for infrequent access). Expanding the dropdown inline — rejected (color picker and text inputs need real screen space).

---

### Settings V1 scope

**Decision:** Three sections:
1. **Profile** — display_name (editable), display_name_short (editable), color picker (7-color palette). Single "Save Changes" button.
2. **App** — Dark mode toggle (stores preference in AsyncStorage; visual color refactor is a separate task).
3. **Household** — Household name (read-only). Fetched from `households` table by `householdId`.

Sign Out is **not** inside the Settings modal — it stays in the avatar dropdown.

**Rationale:** Profile editing and color selection are the most important personalization needs. Dark mode preference can be stored now even if visual implementation is deferred. Household name gives context without requiring the full member list (which belongs to multi-user features).

---

### Dark mode: preference storage vs. visual implementation

**Decision:** Store the preference in AsyncStorage via a new `ThemeProvider` in `lib/theme.tsx`. Visual implementation (replacing hardcoded hex values with dynamic color tokens across all screens and components) is a separate follow-on task.

**Rationale:** Adding the toggle and storing the preference is low-risk and isolated. The color refactor touches every screen and component — it warrants its own focused spec and review cycle.

**Implementation note:** `ThemeProvider` reads the stored preference on startup and exposes `{ isDark, toggleTheme }` via `useTheme()`. Default is the system colorScheme if no preference is stored. The follow-on refactor will make components read from `useTheme()` instead of hardcoded values.

---

### Profile color picker UI — *novel pattern*

**Decision:** A horizontal row of 7 filled circles (32px diameter). The currently-selected circle shows a white inner ring (2px `borderWidth`, `borderColor: white`, inset via padding). Tap any circle to select it.

**Rationale:** Compact, visual, immediately communicates the color choices. Extension of the chip selection pattern (stores/categories in items.tsx) but uses colored circles rather than text chips.

**Alternatives considered:** Text chips with colored backgrounds ("Blue", "Green"…) — less efficient for color selection; the color itself is more informative than the name.

**→ New pattern — update ui-guidelines.md §17 Decision Log.**

---

### Color conflict soft warning

**Decision:** If the selected color is already used by another household member, show inline warning text below the color row: *"Another member uses this color"*. Does not block saving.

**Rationale:** Established in ui-guidelines.md §2. Small query cost (`useHouseholdMemberColors`), meaningful UX signal in multi-user households.

---

### Header unification

**Decision:** Add a shared `HeaderActions` component (`components/HeaderActions.tsx`) containing undo button, redo button, and UserAvatar. The Items and History headers use this component on the right side of their title rows. The Shopping List header is **not** refactored — it already has avatar and undo/redo and is significantly more complex.

**Rationale:** Items and History currently lack the UserAvatar, which is the access point for Settings. Extracting `HeaderActions` avoids triplicating the undo/redo + avatar logic.

---

### Undo/redo on History and Items tabs

**Decision:** Show always on all tabs. The undo stack is global and session-scoped — actions taken on the Shopping List can be undone from any tab. Neither Items nor History mutations currently register undo actions, but that may change in future specs.

**Rationale:** Consistency across tabs. Hiding/disabling the buttons conditionally adds logic for minimal benefit; the global stack already handles no-op cases gracefully.

---

### Household name display

**Decision:** Read-only text field showing the `households.name` value. Fetched by a `useHouseholdName(householdId)` hook in `api/profile.ts`.

**Rationale:** Gives the user context about which household they belong to. Full member list and multi-household management are deferred to future features.

---

## Data Mutations

### `useUpdateProfile` (new, in `api/profile.ts`)

Updates `profiles` table for the current user's own row:
```typescript
supabase
  .from('profiles')
  .update({ display_name, display_name_short, color })
  .eq('id', session.user.id)
```

- **No household guard** — this is a self-update, not a household-scoped insert.
- **No realtime mutation tracking** — does not touch `list_items`.
- **No undo registration** — settings changes are not undoable.
- **On success:** invalidate `['my_profile']` (causes `HouseholdContext` + `UserAvatar` to refresh with new name/color).

### `useHouseholdName` (new, in `api/profile.ts`)

```typescript
supabase.from('households').select('name').eq('id', householdId).single()
```
React Query key: `['household_name', householdId]`

### `useHouseholdMemberColors` (new, in `api/profile.ts`)

Fetches colors of all *other* household members (for conflict warning):
```typescript
supabase
  .from('profiles')
  .select('color')
  .eq('household_id', householdId)
  .neq('id', currentUserId)
```
React Query key: `['household_member_colors', householdId]`

---

## New Files

| File | Purpose |
|------|---------|
| `components/Settings.tsx` | Full-screen Settings modal (profile + app + household sections) |
| `components/HeaderActions.tsx` | Shared undo + redo + UserAvatar row, used by Items and History headers |
| `api/profile.ts` | `useUpdateProfile`, `useHouseholdName`, `useHouseholdMemberColors` |
| `lib/theme.tsx` | `ThemeProvider` + `useTheme()` hook, backed by AsyncStorage |

---

## Files to Modify

| File | Change |
|------|--------|
| `components/UserAvatar.tsx` | Add "Settings" menu item above "Sign Out"; manage `settingsVisible` state; render `<Settings>` modal |
| `app/(tabs)/items.tsx` | Add `<HeaderActions>` to the right side of the title row |
| `app/(tabs)/history.tsx` | Add `<HeaderActions>` to the right side of the screen header |
| `app/_layout.tsx` | Wrap with `<ThemeProvider>` |

---

## Out of Scope

- Visual dark theme implementation (color token refactor across all screens/components) — separate follow-on task
- Household member list in Settings — deferred until F2 (Multi-User Trip Management) advances
- Multi-household management (switching households, invites) — separate feature
- Profile avatar image upload — no design decision yet

---

## Open Questions

None — all design decisions resolved.
