# List Interaction Modes & Header Consolidation

## Problem

Currently:
- Two redundant headers: Expo tab header ("Shopping List" + info icon) and custom `globalHeader` ("Shopping List" + undo/redo).
- Tap interaction is split: checkbox area = toggle purchased, item name = open edit modal. This works for list management but is friction-heavy when actively shopping (small tap target for the checkbox).
- The settings button is an "info-circle" icon that goes directly to a sign-out screen. It doesn't convey its purpose and wastes a navigation-level header.

## Design

### 1. Consolidated Header

Remove the Expo tab header (`headerShown: false` on the index tab screen). The custom `globalHeader` becomes the single header with everything:

```
Shopping List        [🛒] [↩️] [↪️] [M]
                      mode undo redo avatar
```

- **Mode toggle**: Shopping cart (shopping mode) or pencil (planning mode).
- **Undo/Redo**: Existing buttons, unchanged.
- **User avatar**: Circle with the first letter of `display_name_short` (or first letter of email as fallback), using the user's `profiles.color` as background. Replaces the info-circle icon.

### 2. User Avatar Menu

Tapping the avatar circle opens a dropdown/popover menu (not a full-screen modal navigation):

- **Display name** (non-interactive, shown at top for context)
- **Settings** → navigates to settings screen (future: display name editing, color picker, household management)
- **Sign Out** → signs out and clears query cache

This replaces the current flow of info-circle → full-screen modal → sign out button.

### 3. Interaction Modes

Two modes controlled by the header toggle. Mode persists within the session. Default: **Shopping mode** on app launch.

#### Shopping Mode (default)
Optimized for checking off items at the store.

- **Single tap** anywhere on the item row → toggle purchased
- **Long press** on the item row → open edit modal
- **Edit icon** (small pencil) visible at trailing edge of each row → open edit modal (discoverability fallback, especially for web where long press is less intuitive)
- **Drag handle** unchanged (long press on grip icon to reorder)

#### Planning Mode
Optimized for building and organizing the list before shopping.

- **Single tap** on item name → open edit modal (current behavior)
- **Checkbox tap** → toggle purchased (current behavior)
- **Drag handle** unchanged

#### Visual Differentiation
The current mode should be obvious at a glance:
- The mode toggle icon changes (cart vs pencil)
- Optionally: a subtle background tint change or a small mode label under the title

### 4. Long Press on Web

React Native's `onLongPress` (via `Pressable`) works on web using mousedown/mouseup timing. Combined with the always-visible edit icon, both platforms have a clear path to the edit modal:

- **Mobile**: long press (natural) or edit icon
- **Web**: edit icon (primary) or long press (power users)

### 5. Changes to `(tabs)/_layout.tsx`

- Set `headerShown: false` on the index tab screen
- Remove the `headerRight` with the info-circle `Link` to `/modal`
- The items tab header can stay as-is (or be consolidated similarly in the future)

### 6. Changes to `(tabs)/index.tsx`

- Add mode toggle button to `globalHeader`
- Add user avatar button to `globalHeader` (replaces info-circle navigation)
- Add `interactionMode` state: `'shopping' | 'planning'`
- Conditional tap handlers based on mode
- Add small edit icon to each item row (visible in both modes in shopping mode, hidden in planning mode where tap-to-edit is the default)

### 7. New Component: `UserAvatar`

Small component that:
- Fetches `display_name_short` and `color` from `useHousehold()` or a new `useProfile()` hook
- Renders a colored circle with the first letter
- Handles the menu popover on press

## Implementation Order

1. Consolidate headers (remove tab header, move settings action to custom header)
2. Replace info-circle with user avatar (letter circle, using email fallback initially)
3. Avatar menu with Sign Out (replace modal navigation)
4. Add interaction mode state and toggle button
5. Implement shopping mode tap handlers (single tap = check, long press = edit)
6. Add edit icon to item rows
7. Wire planning mode as the current behavior behind the toggle

## Future Considerations

- **Haptic feedback** on long press (mobile) to confirm edit mode activation
- **Auto-mode switching**: Optionally auto-switch to shopping mode when first item is checked off, and back to planning when list is empty
- **Per-tab mode memory**: If the Items tab gets similar treatment, each tab could remember its own mode
