# UI Guidelines
<!-- Living document. Updated during /design sessions when new patterns are established, or when implementation decisions set visual precedents. -->

> **How this works:** Established patterns are followed without discussion. TBD sections are placeholders — they get filled in when a feature requires that decision. Novel territory (first time doing X) is always discussed with the user before speccing.

---

## 1. Navigation & Screen Structure

### Tab Bar
- Implementation: Expo Router `<Tabs>` with Expo's `FontAwesome` icon library (not lucide-react-native)
- Tab icons are `<FontAwesome size={28}>` components via the `TabBarIcon` helper in `(tabs)/_layout.tsx`
- Active tint color: `Colors[colorScheme].tint` from `constants/Colors`
- Currently: Shopping List (`shopping-cart`), Items (`book`), History (`history`)
- **Adding a new tab:** Add a `<Tabs.Screen>` entry in `client/app/(tabs)/_layout.tsx`

### Screen Layout
- All main tabs use `headerShown: false`; each screen manages its own header with `useSafeAreaInsets` for safe area handling
- Header right side: `HeaderActions` component (undo + redo + UserAvatar) — shared across Items, History, and Shopping List
- Shopping List: custom header also includes contextual content (store filter, add-item UI)

### Navigation between screens
- All main screens are tabs — no deep linking between them currently
- Detail views use modals (see Modals section), not separate routes
- [TBD: if/when a screen needs sub-navigation (e.g., drill-down beyond a modal), decide on pattern]

---

## 2. Color System

### App Chrome
These come from `client/constants/Colors.ts` — the current values are the **default Expo scaffold, not yet customized**:

| Token | Light | Dark |
|-------|-------|------|
| `text` | `#000000` | `#ffffff` |
| `background` | `#ffffff` | `#000000` |
| `tint` | `#2f95dc` | `#ffffff` |
| `tabIconDefault` | `#cccccc` | `#cccccc` |
| `tabIconSelected` | `#2f95dc` | `#ffffff` |

**These are placeholders.** The app has not yet established a custom color palette. Customize `constants/Colors.ts` when ready.

### De-Facto UI Color Palette
The existing screens use **Tailwind color hex values as hardcoded constants** consistently across components. These are the established values — use them for new UI rather than introducing new hex values:

| Role | Hex | Tailwind | Used for |
|------|-----|----------|----------|
| Primary / interactive | `#2563eb` | blue-600 | Buttons, active states, links |
| Text primary | `#111827` | gray-900 | Main content text |
| Text secondary | `#374151` | gray-700 | Labels, secondary content |
| Text muted | `#6b7280` | gray-500 | Metadata, captions |
| Placeholder / disabled | `#9ca3af` | gray-400 | Input placeholders, inactive |
| Error | `#991b1b` | red-800 | Error messages |
| Success | `#166534` | green-800 | Success messages |
| Highlight / star | `#fbbf24` | amber-400 | Default store indicator |

> These values are not yet in a shared constants file — they are hardcoded per-component. When the palette is finalized, consolidate into `constants/Colors.ts`.

### Data-Driven Colors
These are established and should not change:
- **Store colors:** `stores.color_code` — used in store section headers on the shopping list
- **User/profile colors:** `profiles.color` — used for multi-user check-off indicators. See Profile Color Palette below.

### Profile Color Palette (F2)
Each user profile is assigned a distinct color for identity across the app (checked items, trip dialogs, history). Colors are auto-assigned at profile creation (first unused in the household) and user-changeable in Settings (F7).

| # | Color | Hex | Tailwind |
|---|-------|-----|----------|
| 1 | Blue (default) | `#2563eb` | blue-600 |
| 2 | Green | `#16a34a` | green-600 |
| 3 | Orange | `#ea580c` | orange-600 |
| 4 | Purple | `#9333ea` | purple-600 |
| 5 | Red | `#dc2626` | red-600 |
| 6 | Teal | `#0d9488` | teal-600 |
| 7 | Pink | `#db2777` | pink-600 |

Cycles from the top if the household has more than 7 members. Soft conflict warning in Settings if a user picks a color already used by a household member.

### Semantic Colors

| Role | Hex | Tailwind | Used for |
|------|-----|----------|----------|
| Warning (high severity) | `#f59e0b` | amber-500 | Avoided store badges, warning toasts |
| Warning (critical) | `#ef4444` | red-500 | Unavailable store badges |
| Warning (informational) | `#6b7280` | gray-500 | Non-preferred store, non-standard qty badges |

- Disabled / inactive state: [TBD]
- Purchased / completed item strikethrough color: [TBD]

---

## 3. Typography

[TBD — not yet formally established. Document font sizes, weights, and line heights as screens are built.]

Guiding principle: use the system font (React Native default). Do not import custom fonts unless explicitly decided.

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Screen title | [TBD] | [TBD] | |
| List item primary text | [TBD] | [TBD] | |
| List item secondary/metadata | [TBD] | [TBD] | |
| Empty state message | [TBD] | [TBD] | |
| Button label | [TBD] | [TBD] | |

---

## 4. Spacing & Layout

[TBD — not yet formally established. Document as screens are built.]

Guiding principle: use consistent multiples (e.g., 4/8/12/16px scale) rather than arbitrary values. When the first decision is made, establish a base unit here.

---

## 5. Icons

**Two icon libraries are in use — do not mix their usage contexts:**

| Context | Library | Notes |
|---------|---------|-------|
| Tab bar icons | `@expo/vector-icons/FontAwesome` | Used in `(tabs)/_layout.tsx` only |
| In-screen icons | `lucide-react-native` | Used in all components and screens |

When adding a tab: pick a FontAwesome icon name. When adding an icon inside a screen: pick from lucide-react-native.

### Standard icon assignments
[TBD — document as icons are chosen for features]

| Action/concept | Icon | Library |
|----------------|------|---------|
| Shopping List tab | `shopping-cart` | FontAwesome |
| Items tab | `book` | FontAwesome |
| History tab | `history` | FontAwesome |
| Close/dismiss | [TBD] | lucide |
| Edit | [TBD] | lucide |
| Delete | [TBD] | lucide |
| Add / Plus | [TBD] | lucide |
| Drag handle | [TBD — GripVertical?] | lucide |
| Right chevron (tappable row) | [TBD] | lucide |

---

## 6. Lists

| Use case | Component | Notes |
|----------|-----------|-------|
| Shopping list (drag-and-drop) | `DraggableFlatList` from `react-native-draggable-flatlist` | Mixed header + item rows; long-press grip to drag |
| All other lists | React Native `FlatList` | Default choice for any scrollable list |
| Short static content | `ScrollView` | Only when items are not uniform and count is small/fixed |

Do not use `ScrollView` for lists of unknown/variable length — use `FlatList`.

---

## 7. Modals

React Native `<Modal>` component (not a third-party sheet library). Two patterns depending on content type:

---

### 7a. Dialog Modals (forms, short confirmations)

Used for: editing a list item, adding a master item, creating a store, adding an item to the list with options.

```
<Modal animationType="slide" transparent={true}>
  <KeyboardAvoidingView behavior={ios ? 'padding' : 'height'} style={modalOverlay}>
    <View style={modalContent}>
      <View style={modalHeader}>
        [destructive icon btn (optional, left)] · [title] · [X close btn (right)]
      </View>
      <ScrollView keyboardShouldPersistTaps="handled">
        [form fields]
      </ScrollView>
      <View style={modalActions}>
        [Cancel btn] [Primary btn]   ← right-justified, compact
      </View>
    </View>
  </KeyboardAvoidingView>
</Modal>
```

**Overlay** (`modalOverlay`): `flex: 1, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.5)'`

**Card** (`modalContent`): `backgroundColor: 'white', borderRadius: 16, padding: 24` — add `maxHeight: '85%'` when the form may be tall.

**Header** (`modalHeader`): `flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16`
- Title: just the item/screen name — no "Edit:" prefix
- Close button: `X` icon (24px), gray (`#6b7280`), top-right — always present
- Destructive action (delete): `Trash2` icon in `#fee2e2` background pill, top-left — only when the action is available. Keeps destructive action visually separated from close.

**Action row** (`modalActions`): `flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8`
- Buttons: `paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10` — compact, not full-width
- Cancel: gray (`#e5e7eb` / `#f3f4f6` bg, `#374151` text)
- Primary: blue (`#2563eb` bg, white text)
- Label: short and action-focused — "Save", "Add", not "Save Changes" or "Update Item"

**Keyboard**: `KeyboardAvoidingView` prevents the keyboard from covering action buttons. `ScrollView` with `keyboardShouldPersistTaps="handled"` inside so chip/tag taps work while keyboard is open.

---

### 7b. Full-Screen Modals (detail views, settings, multi-step flows)

Used for: trip history detail, Settings, multi-user trip end dialog.

```
<Modal animationType="slide" transparent={false}>
  <SafeAreaView>  {/* or manual insets.top padding on header */}
    <View style={header}>
      [title (flex: 1)] · [X close btn (right)]
    </View>
    [FlatList or ScrollView for content]
    [footer action row if needed]
  </SafeAreaView>
</Modal>
```

- Full white background, no overlay dimming
- Header close button: `X` icon, top-right
- Footer actions (if present): full-width row, `flex: 1` buttons — appropriate for large-screen navigational modals

---

### 7c. Modal Compliance Checklist

**Applies to new and modified modals.** Existing non-compliant modals (`SmartAddItem.tsx` add-detail, `index.tsx` edit-item) are being brought into compliance in F23. Do not add these to the checklist retroactively for unrelated features.

Before shipping any modal (dialog or full-screen), verify:

| | Requirement | Reference |
|---|---|---|
| ☐ | `useSafeAreaInsets()` applied — at minimum `paddingTop: insets.top` on outermost container | CODING.md §7 |
| ☐ | `ScrollView` wraps body content with `keyboardShouldPersistTaps="handled"` when TextInput is present | CODING.md §7 |
| ☐ | `maxHeight: '85%'` on modal card when content may be tall | §7a |
| ☐ | X close button top-right (always present) | §7a |
| ☐ | Cancel button in action row for dialog modals | §7a |
| ☐ | Destructive action (if any) top-left as icon pill, not in action row | §7a |
| ☐ | No stacked modals — close the current modal before opening another (see §7d) | §7d |
| ☐ | `handleSave` flushes pending sub-inputs (alias chips, tag editors, etc.) before building payload (see §7e) | §7e |
| ☐ | Edit modals: Save disabled until form is dirty (see §7f) | §7f |

**Reference implementations (use as copy-from baseline):**
- Dialog modal: `app/(tabs)/items.tsx` — X close + action row + dirty-state Save + in-document dropdown
- Full-screen modal: `components/Settings.tsx` — keyboard-safe scroll, safe-area insets
- Multi-step modal: `components/MultiTripModal.tsx`

---

### 7d. No Stacked Native Modals

iOS silently drops or ignores a second `<Modal>` presented while one is already visible. **Never open a modal while another modal is active.**

When navigating from one modal to another:
1. Close the first modal (`setFirstVisible(false)`)
2. Open the second modal (`setSecondVisible(true)`)
3. Use a state flag (e.g., `resumeEditAfterX`) to restore the first modal when the second closes

```tsx
// Opening second modal from within first
onPress={() => {
  setResumeFirstAfterSecond(true);
  setFirstVisible(false);
  setSecondVisible(true);
}}

// Second modal onClose
onClose={() => {
  setSecondVisible(false);
  if (resumeFirstAfterSecond) {
    setFirstVisible(true);
    setResumeFirstAfterSecond(false);
  }
}}
```

**Reference:** `items.tsx` — "Define Abbreviations" flow closes edit modal before opening Abbreviations modal, restores on return (#93).

---

### 7e. Flush Pending Sub-Inputs on Save

Modal forms with inline sub-inputs (alias chips, tag editors, etc.) must commit any pending input at the top of `handleSave`, before building the save payload. This prevents data loss when the user types a value and taps Save without explicitly confirming the sub-input.

```tsx
const handleSave = async () => {
  // Flush pending sub-input FIRST
  const aliasesToSave = commitPendingInput(aliases);
  // Then build payload using flushed values
  const payload = { ...fields, aliases: aliasesToSave };
};
```

Additionally, `onBlur` handlers on sub-inputs must not destructively clear uncommitted user input. Hide the input UI if needed, but preserve the typed value so the parent Save can consume it.

**Reference:** `items.tsx` — alias input `onBlur` hides the field but preserves `newAliasInput`; `handleSave` calls `commitPendingAliasInput()` (#93).

---

### 7f. Dirty-State Save for Edit Modals

Edit modals (modals that open with pre-populated data) must disable Save until the form has meaningful changes. This prevents no-op saves and gives users clear feedback about whether they've changed anything.

**Pattern:**

1. On modal open, serialize form state to a snapshot string (`initialFormSnapshot`)
2. Use `useMemo` to serialize current form state on every change (`currentFormSnapshot`)
3. Derive `canSave` from snapshot comparison + any pending sub-inputs:
   ```tsx
   const canSave = useMemo(() => {
     if (requiredField.trim().length === 0) return false;
     const hasFormChanges = initialFormSnapshot !== null
       && currentFormSnapshot !== initialFormSnapshot;
     return hasFormChanges || hasPendingSubInput;
   }, [requiredField, initialFormSnapshot, currentFormSnapshot, hasPendingSubInput]);
   ```
4. Apply to Save button: `disabled={!canSave}` + disabled styling (`backgroundColor: '#9ca3af'`, text `color: '#e5e7eb'`)

**Serialization guidelines:**
- Normalize before comparing: trim strings, lowercase case-insensitive fields, sort unordered collections
- Filter out default/neutral values (e.g., store preferences with status `'neutral'` and empty comment)
- Use `JSON.stringify` on the normalized object — simple, deterministic, no custom equality logic needed
- Keep the serialization function pure and outside the component (at module scope)

**Applies to:** Edit modals only. Add/create modals use form-validity checks instead (e.g., require name to be non-empty) — they don't have a baseline to compare against.

**Reference:** `items.tsx` — `serializeFormSnapshot()`, `currentFormSnapshot`, `canSave` (#95).

---

## 8. Dialogs & Confirmations

**Established pattern** (from CODING.md):

```typescript
if (Platform.OS === 'web') {
  if (window.confirm('Message')) { doAction(); }
} else {
  Alert.alert('Title', 'Message', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: doAction },
  ]);
}
```

- Use for: destructive confirmations (delete, end trip)
- Always guard with `Platform.OS === 'web'` check
- Do not use `Alert` for non-destructive feedback — use toast or inline state instead

---

## 9. Loading States

**Established pattern:** `<ActivityIndicator>` centered on screen (or centered within a list area).

```tsx
{isLoading && <ActivityIndicator style={styles.centered} />}
```

[TBD: size (`"small"` vs `"large"`) and color preferences for different contexts]

---

## 10. Empty States

**Established pattern:** centered text message when a list/screen has no data.

```tsx
{data?.length === 0 && (
  <Text style={styles.emptyText}>No past trips yet</Text>
)}
```

Message format: `"No [items] yet"` or `"[Feature] will appear here"`.

[TBD: styling — font size, color, any supporting icon or illustration?]

---

## 11. Error States

[TBD — not yet established. Decide during /design when first screen with explicit error handling is built.]

Options to consider: inline error text, toast notification, retry button.

---

## 12. Toast Notifications

**Established component:** `components/Toast.tsx`

- Position: absolute, bottom of screen
- Animation: fade in / fade out
- Auto-dismisses after 3 seconds
- Used for: remote change notifications from other household members
- Do **not** create a second toast component — extend or reuse `Toast.tsx`

[TBD: use Toast for local success feedback (e.g., "Item added") or use a different pattern?]

---

## 13. Forms & Inputs

**Established patterns:**
- Quantity: chip bar of quick-select options (`alternate_qtys`) + manual text fallback — established in `SmartAddItem.tsx`
- Store (header + items screen): color-dot dropdown picker — established in `StoreSelector.tsx` (F12) and `items.tsx` (F16)
- Store (add-detail + edit-item modals): currently pill row in `SmartAddItem.tsx` and `index.tsx`; being replaced with color-dot dropdown in F23
- Text search: `TextInput` with live dropdown results below — established in `SmartAddItem.tsx`

[TBD — general input styling (border, focus state, placeholder color) not yet formally established]
[TBD — validation error display pattern not yet established]

---

## 14. User Identity on Checked Items (F2)

Used on the shopping list to distinguish which checked-off items belong to the current user vs. other household members. No extra space or badges required — the checkbox style itself carries the signal.

| | Checkbox style |
|---|---|
| **Current user** | Outlined circle, checkmark in their profile color, white fill |
| **Other users** | Filled circle in their profile color, white checkmark (inverted) |

Example: user's color = green, household partner's color = blue
- User's items: green outlined circle + green check on white — familiar "checked" look
- Partner's items: blue filled circle + white check — visually inverted, immediately distinct

**Why inversion works:**
- No extra elements or space on the row
- The filled/outlined distinction separates "mine" from "not mine" regardless of color
- Works for any number of users as long as profile colors are distinct

This is a **novel pattern** in this app. All future features needing "mine vs. others" distinction on list items should follow this inverted-checkbox approach.

---

## 15. Interaction Patterns

| Gesture | Current use | Notes |
|---------|-------------|-------|
| Tap | Primary action on all interactive elements | Universal |
| Long press | Activates drag handle on shopping list items | Don't add new long-press behaviors without discussing |
| Swipe | Not yet used | Decide before introducing |
| Pull to refresh | Not yet used | Decide before introducing |

---

## 16. Dark Mode

**Established (F81).** All new components must use `useThemeColors()` from `lib/theme.tsx` rather than hardcoded hex values.

### Theme preference

Three states: `'system' | 'light' | 'dark'`. Stored in AsyncStorage (key `@app_theme_pref`). "System" defers to the device `useColorScheme()` at runtime. Exposed via `useAppTheme()` as `themePreference` (stored) and `isDark` (resolved boolean).

### Color hook pattern

```typescript
import { useThemeColors } from '@/lib/theme';

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: { backgroundColor: colors.background },
  text: { color: colors.textPrimary },
});

export function MyComponent() {
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
}
```

### Token reference

See the full `AppColors` type and light/dark values in `constants/Colors.ts`. Summary:

| Token | Role |
|-------|------|
| `background` | Main screen background |
| `surface` | Modal bodies, input backgrounds, list rows, cards |
| `surfaceRaised` | Section headers, chip rows, badge pill backgrounds |
| `border` | Dividers, separator lines |
| `inputBorder` | Text input borders (slightly darker than `border` in light) |
| `textPrimary` / `textSecondary` / `textMuted` / `textDisabled` | Text hierarchy |
| `primary` / `primaryForeground` | Interactive elements |
| `destructiveText` / `destructiveSurface` | Error text, red icon pill backgrounds |
| `buttonSecondary` / `buttonSecondaryText` | Cancel/secondary button |
| `modalOverlay` | Translucent backdrop |
| `star` | Default store amber indicator (unchanged in dark) |

**Fixed signal colors** (not theme tokens): warning badge colors (amber-500, red-500, gray-500) and data-driven colors (store `color_code`, profile `color`) are **not** swapped by the theme — they must render as defined regardless of mode.

### Test both modes

All new screens and components must be verified in both light and dark modes before shipping.

---

## 17. Decision Log

When a new visual or interaction pattern is established during a `/design` session, append it here with the feature it came from. This prevents re-litigating the same decision on future features.

| Decision | Value | Set by | Notes |
|----------|-------|--------|-------|
| User identity color system | Fixed profile colors, auto-assigned from 7-color palette, user-changeable | F2 | See §2 Profile Color Palette for the full palette |
| "Mine vs. others" on checked items | Current user = outlined checkbox in their color. Others = filled/inverted checkbox in their color + white check | F2 | See §14; no extra space or badges needed |
| Multi-user end trip dialog | React Native `<Modal>` (not Alert.alert) | F2 | Needed for per-user checkbox rows |
| De-facto color palette | Tailwind hex values as hardcoded constants (blue-600, gray-900, etc.) | Observed | See §2 De-Facto UI Color Palette; consolidate into constants file when palette is finalized |
| Trip/list row owner display | Show owner name only for other users' trips, not your own; format: `"· Name"` before item count | F9 | Keeps list clean for single-user households; absence of name = "mine" |
| Owner name in modal header | Append `" · Name"` at end of header only when trip belongs to another user | F9 | Consistent with row pattern; your own modal headers stay clean |
| Profile color picker | Row of 7 filled circles (32px); selected circle shows white inner ring via 2px border | F7 | Extension of chip selection pattern; color circles replace text chips |
| Active store selector in header | Store name + ▾ chevron replaces "Shopping List" title; tap opens dropdown picker | F12 | Store context is more useful than a static title |
| Store selector dropdown | Color dot + name per row, checkmark on active, "+ Add new store" at bottom | F12 | First dropdown picker pattern in the app |
| Multi-line list item row | Line 1: name (15px/500), Line 2: qty · category · store (12px muted, dot-separated). Auto height ~52-56px | F13 | Replaces single-line 48px row for better density |
| Warning badge system | Per-type icon + color: AlertTriangle/amber (avoided), XCircle/red (unavailable), Info/gray (non-preferred), HelpCircle/gray (non-standard qty). 14px lucide icons | F13 | First warning/caution visual in the app; shape + color for accessibility |
| Warning badge tap → popover (current) | Tap badge shows absolutely-positioned tooltip with detail text; dismiss on tap-outside | F13 | **Will change when F22 ships** — current pattern is unreliable on clipped containers; F22 replaces it with a centered `<Modal>` (X close + backdrop dismiss). Update this entry when F22 is shipped. |
| Warning toast styling | Amber-tinted background variant of Toast.tsx; 4s duration; combines all warnings from one add | F13 | Extension of existing Toast component |
| Freeform input popover | Absolutely-positioned floating card with a single TextInput, confirmed via keyboard Return; no explicit OK button; anchored near the triggering element | F15 | First interactive input popover in the app; test on device for keyboard coverage |
| Dialog modal pattern | Centered card (not bottom sheet); KAV + ScrollView inside; compact right-justified buttons; X close top-right; destructive icon top-left when present; title = item name only (no "Edit:" prefix) | UI cleanup | See §7a for full spec |
| Store preference section | Single section in item edit modal: store dropdown + status pills (tap = set immediately, no +/− buttons) + inline comment field (visible when store selected, no Save Comment button — saves with modal Save) + read-only summary + read-only all-comments list. Status labels: —, Pref., Avoid, Unavailable (not N/A). ScrollView ref + scrollToEnd on comment onFocus for keyboard visibility. | F16 | Replaces all-stores segmented-button layout; no comment edit modal or separate comment save step needed |
| Store display — three contexts | (1) **Header active-store selector** (`StoreSelector.tsx`): text-only trigger + dropdown. (2) **Store preference editor** (`items.tsx`): color-dot dropdown. (3) **Item add/edit store picker** (`SmartAddItem.tsx`, `index.tsx`): pill row → being replaced with color-dot dropdown in F23. Do not treat these as a single unified pattern until F23 ships. | F23 | Three separate patterns; §13 "established dropdown" only applies to contexts 1 and 2 until F23 lands |
| Editable alias chips | Chip row with `×` remove button per chip + `+ Add alias` inline text input (Return to confirm, blur to dismiss). Extension of the established chip selection pattern from SmartAddItem. Use for any form field that manages a variable-length list of short text values. | F79 | Dialog modal (7a) context; chips are removable unlike read-only qty chips |
| Avatar menu structure | Tap avatar → flat popover menu. Top-level items: "General" (profile/app settings), "Sizes & Packages" (vocabulary management), and "Abbreviations" (token alias management). "Sizes & Packages" navigates to a drill-down screen with three rows (Units, Packages, Sizes), each opening a full-screen management modal. | F79, F90 | Drill-down screen, not cascading popover — uses established full-screen modal pattern. "Abbreviations" added as 3rd top-level item in F90. |
| Abbreviations screen | Full-screen modal with toggle (canonical→aliases / alias→canonical), OR search bar, one row per word. Search creates placeholder rows for words without aliases. Tap row → edit dialog (§7a) with alias chips, text input, suggestions, inline conflict warnings. Launched from avatar menu (empty search) or item edit ("Define Abbreviations" button pre-populates search with item's words). | F90 | Unified management + definition surface; no separate "add" button — search creates new entries |
| No stacked native modals | Close first modal before opening second; resume flag to restore on return. iOS silently drops stacked modals. | #93 | See §7d. Reference impl: `items.tsx` Define Abbreviations flow |
| Flush pending sub-inputs on Save | `handleSave` commits inline sub-inputs (alias chips, tags) before building payload. `onBlur` must not clear uncommitted input. | #93 | See §7e. Reference impl: `items.tsx` `commitPendingAliasInput()` |
| Inline conflict warnings (alias creation) | Amber/red warning text below input field, live-updating per keystroke. Blocking conflicts (duplicate alias key) show red text and disable Save. Non-blocking conflicts (vocabulary token overlap, item name overlap, unknown canonical word) show amber text but allow Save. | F90 | First live-validating inline warning in the app; pattern reusable for other form validation |
| Item edit — read-only alias reference | "Active Abbreviations" section on item edit modal showing token aliases relevant to this item's words. Read-only text format: `chicken → chk, chkn`. "Define Abbreviations" button launches Abbreviations screen with pre-populated search. | F90 | Read-only reference + launch point; alias editing happens on the Abbreviations screen, not inline |
| Top-result dropdown highlight | Two-tier: always-on `#eff6ff` (blue-50) on first result row; armed state intensifies to `#dbeafe` (blue-100) + 3px left border `#2563eb` (blue-600). First "pre-selected" row pattern in the app. | F99 | Signals what Enter/trigger word will add; graduated intensity distinguishes informational from actionable |
| Armed-state search box tint | Search box background shifts from white to `#eff6ff` (blue-50) when quick-accept is armed. State indicator placed at the input where attention naturally sits. | F99 | Separated from row highlight — search box = state, row = target |
| Bottom-anchored dialog modal | 7a dialog card with `justifyContent: 'flex-end'` instead of `'center'`. Card slides up from bottom, keeping content above (search bar, list) visible behind dimmed backdrop. KAV + ScrollView still apply. Use for contextual quick-decision dialogs where surrounding screen context matters. Centered 7a remains default for form/edit modals. | F78 | First non-centered dialog modal; justified by contextual nature of duplicate resolution |
| Uniform button styling for choice dialogs | When a dialog presents 4+ options with no objectively primary action, use uniform button styling (gray-100 bg, dark text) for all actions. Cancel is text-only. Position and grouping provide hierarchy, not color. Follows iOS action sheet pattern. | F78 | Avoids visual noise when correct choice depends on user intent |
| "on list" passive indicator | Small muted gray (`#9ca3af`) "on list" text on SmartAddItem dropdown rows where the item already exists on the shopping list. Single indicator regardless of active/purchased state. Right side of result title row. | F78 | First passive state indicator in search results |
| Dark mode color source | All components use `useThemeColors()` hook from `lib/theme.tsx`; never hardcode hex values. `makeStyles(colors)` pattern with `useMemo` for memoization. See §16. | F81 | Replaces de-facto hardcoded Tailwind hex constants |
| Theme preference: 3-state | Settings Appearance: System / Light / Dark. System follows device at runtime. Stored in AsyncStorage per device. `isDark` computed from resolved preference. | F81 | Not synced to profiles table — display mode is device-specific |
| Appearance toggle UI | Three tappable radio rows (System / Light / Dark) under "APPEARANCE" section in Settings. Active row shows Lucide `Check` on right. System row has subtitle "Follows device setting". | F81 | Extension of tappable-row pattern; no new component type |
