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
- Shopping List: custom header (headerShown: false on the tab); screen manages its own header
- Items: standard Expo Router header
- [TBD: preferred header pattern for new screens — custom vs. default Expo router header]

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

### Data-Driven Colors
These are established and should not change:
- **Store colors:** `stores.color_code` — used in store section headers on the shopping list
- **User/profile colors:** `profiles.color` — used for multi-user check-off indicators (purchased_by)

### Semantic Colors
[TBD — decide during /design sessions]
- Success / confirmation feedback
- Warning / caution states
- Destructive actions
- Disabled / inactive state
- Purchased / completed item strikethrough color

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

**Established pattern:** React Native `<Modal>` component (not a third-party sheet library).

```
Structure:
  <Modal visible={...} animationType="slide" transparent={false}>
    <SafeAreaView>
      [Header row: title left, close button right]
      [Content: FlatList or ScrollView]
    </SafeAreaView>
  </Modal>
```

- Close button: top-right corner of the modal header
- Animation: `animationType="slide"` (slides up from bottom)
- Use for: detail views, item editing, trip detail drill-down
- Do **not** use `Alert` for detail content — `Alert` is for confirmations only (see Dialogs)

[TBD: preferred close button visual — X icon, "Close" text label, or both?]

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

## 14. Interaction Patterns

| Gesture | Current use | Notes |
|---------|-------------|-------|
| Tap | Primary action on all interactive elements | Universal |
| Long press | Activates drag handle on shopping list items | Don't add new long-press behaviors without discussing |
| Swipe | Not yet used | Decide before introducing |
| Pull to refresh | Not yet used | Decide before introducing |

---

## 15. Dark Mode

Light/dark mode support is scaffolded via `useColorScheme()` and `constants/Colors.ts`. The color tokens in section 2 have both light and dark values.

In practice: new components should use the `Colors[colorScheme]` tokens rather than hardcoded hex values, so dark mode works automatically when the palette is finalized.

[TBD: is dark mode a priority? If yes, test every new screen in both modes. If not, build light-first and revisit.]

---

## 16. Decision Log

When a new visual or interaction pattern is established during a `/design` session, append it here with the feature it came from. This prevents re-litigating the same decision on future features.

| Decision | Value | Set by | Notes |
|----------|-------|--------|-------|
| *(empty — first decisions pending)* | | | |
