# F16 Design: Store Preferences UI Redesign

> Design decisions recorded during pre-spec conversation and review. Referenced by `specs/F16-store-preferences-ui.md`.

---

## Problem

The item edit modal's Store Preferences section renders every store as a row with segmented status buttons. This grows linearly as stores are added and doesn't match the intended add-to-list design.

## Goals

- Compact default state
- Direct pill-tap interaction (no separate save button for preference)
- Comments independent of status — any store can have a comment
- Scales to any number of stores

---

## Data Model

### Schema Change (Migration: `20250101000012_f16_store_prefs_ui.sql`)

Add `'neutral'` to the `status` CHECK constraint on `item_store_preferences`:

```sql
ALTER TABLE item_store_preferences
  DROP CONSTRAINT IF EXISTS item_store_preferences_status_check;

ALTER TABLE item_store_preferences
  ADD CONSTRAINT item_store_preferences_status_check
    CHECK (status IN ('preferred', 'avoided', 'unavailable', 'neutral'));
```

**Critical:** `useUpdateMasterItem` does delete-then-insert. If the INSERT fails (neutral row rejected by old constraint), the DELETE already ran — wiping all preferences. Apply migration before any neutral+comment rows are saved.

**Why neutral rows:** A store with neutral preference can still have a comment. Neutral = row with `status = 'neutral'` and non-null `comment`. Neutral+no-comment rows are never written (filtered at payload time).

### Payload Filter Rule

Include a store entry if: `status !== 'neutral'` OR `comment` is non-empty.

---

## Status Options

Four statuses, displayed as pill buttons:

| Pill label | DB value | Meaning |
|------------|----------|---------|
| `—` | `neutral` | No preference (or tap to clear) |
| `Pref.` | `preferred` | Preferred store for this item |
| `Avoid` | `avoided` | Avoid buying here |
| `Unavailable` | `unavailable` | Item not carried at this store |

**Important:** Use `Unavailable` (not `N/A`) as the pill label — clearer for users.

---

## UI Layout

```
STORE PREFERENCES
──────────────────────────────────────────────────────
[ ● Costco                                         ▾ ]  ← single store dropdown
[ — ] [ Pref. ] [ Avoid ] [ Unavailable ]               ← status pills; tap = set immediately

COMMENT                                                  ← visible only when store selected
[ Only buy on sale...                              ]
[ Save Comment ]

Preferred: Costco, Lunardis                              ← read-only summary (non-neutral)
Avoid: Trader Joe's
Unavailable: Safeway

All Store Comments:                                      ← read-only list (any status w/ comment)
  Costco — "Only buy on sale"
  Trader Joe's — "Organic section only"
```

### Store Dropdown

Same visual pattern as F12 store selector: color dot + store name + ChevronDown icon. Tap to expand a flat list of all stores; tap a row to select + close dropdown. When a store is selected, `pendingCommentText` is populated with that store's existing comment (or empty).

### Status Pills

- Tap immediately calls `updateStoreStatus(selectedPrefStoreId, option.value)`
- No separate `+` or `−` button
- `—` tap sets status to `neutral` (clears preference; comment preserved)
- No-op if no store is selected

### Inline Comment Field

Visible only when `selectedPrefStoreId` is non-empty.
- `TextInput` multiline, value = `storePreferences[selectedPrefStoreId]?.comment ?? ''`
- `onChangeText` calls `updateStoreComment(selectedPrefStoreId, text)` directly — no pending buffer, no Save Comment button
- Comment is committed to the DB when the user taps the modal Save button along with all other changes
- On `onFocus`: `setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100)` — ensures the field is visible above the keyboard (the modal ScrollView has a ref for this)

### Summary Display

Read-only. Groups: `Pref.:` / `Avoid:` / `Unavailable:`. Only non-neutral stores. Alpha-sorted per group. Tapping a store name selects it in the dropdown and populates comment field.

### All Store Comments List

Read-only. Shows all stores (any status) with a non-empty comment. Format: `Store Name — "comment"`. Tapping a row selects that store in the dropdown and populates comment field. Empty state: `"No comments yet."`.

### No Comment Edit Modal

The comment edit modal (second sibling `<Modal>`) is not used. Comments are managed entirely inline.

---

## State Model

```typescript
// New state (2 variables — no pending comment buffer)
const [selectedPrefStoreId, setSelectedPrefStoreId] = useState('');
const [prefDropdownOpen, setPrefDropdownOpen] = useState(false);

// Existing state unchanged
const [storePreferences, setStorePreferences] = useState<StorePreferencesState>({});
```

Reset both in `openModal()`. When store is selected from dropdown: set `selectedPrefStoreId`, close dropdown. No comment text to populate — the comment TextInput binds directly to `storePreferences[selectedPrefStoreId]?.comment`.

---

## Key Behaviors

| Action | Effect |
|--------|--------|
| Select store from dropdown | Fills status pills + populates comment field |
| Tap status pill | Immediately sets that store's preference in state |
| Tap `—` pill | Sets status to neutral; comment preserved in state |
| Tap pill with no store selected | No-op |
| Edit comment text | Calls `updateStoreComment(selectedPrefStoreId, text)` immediately; no Save Comment step |
| Tap store name in summary | Selects store in dropdown; comment field reads from `storePreferences` automatically |
| Tap comment row | Selects store in dropdown; comment field reads from `storePreferences` automatically |
| Item Save | `buildStorePreferencesPayload()` includes non-neutral rows + neutral+comment rows |

---

## Deferred

- Store dropdown search/filter (when store count is large)
