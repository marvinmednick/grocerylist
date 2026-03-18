# UI Guidelines
<!-- Living document. Updated during /design sessions when new patterns are established, or when implementation decisions set visual precedents. -->

> **How this works:** Established patterns are followed without discussion. TBD sections are placeholders — they get filled in when a feature requires that decision. Novel territory (first time doing X) is always discussed with the user before speccing.

---

## 1. Navigation & Screen Structure

### Tab Bar
- Implementation: Expo Router `<Tabs>` with Expo's `FontAwesome` icon library (not lucide-react-native)
- Tab icons are `<FontAwesome size={28}>` components via the `TabBarIcon` helper in `(tabs)/_layout.tsx`
- Active tint color: `Colors[colorScheme].tint` from `constants/Colors`
- Currently: Shopping List (`shopping-cart`), Items (`book`), History (`history`) [when F9 ships]
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

**Established patterns (from SmartAddItem):**
- Quantity: chip bar of quick-select options (`alternate_qtys`) + manual text fallback
- Store: dropdown picker pre-filled with known stores for the item
- Text search: `TextInput` with live dropdown results below

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

Light/dark mode support is scaffolded via `useColorScheme()` and `constants/Colors.ts`. The color tokens in section 2 have both light and dark values.

In practice: new components should use the `Colors[colorScheme]` tokens rather than hardcoded hex values, so dark mode works automatically when the palette is finalized.

[TBD: is dark mode a priority? If yes, test every new screen in both modes. If not, build light-first and revisit.]

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
| Warning badge tap → popover | Tap badge shows absolutely-positioned tooltip with detail text; dismiss on tap-outside | F13 | First tooltip/popover pattern in the app |
| Warning toast styling | Amber-tinted background variant of Toast.tsx; 4s duration; combines all warnings from one add | F13 | Extension of existing Toast component |
| Freeform input popover | Absolutely-positioned floating card with a single TextInput, confirmed via keyboard Return; no explicit OK button; anchored near the triggering element | F15 | First interactive input popover in the app; test on device for keyboard coverage |
| Dialog modal pattern | Centered card (not bottom sheet); KAV + ScrollView inside; compact right-justified buttons; X close top-right; destructive icon top-left when present; title = item name only (no "Edit:" prefix) | UI cleanup | See §7a for full spec |
