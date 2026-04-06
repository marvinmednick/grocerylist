# Implementation Plan: F91 Alias System UI

## Files to Modify

- `client/components/UserAvatar.tsx` —
  1. **Abbreviations modal state and import** — add `abbreviationsVisible` state and import `Abbreviations` using the same pattern as `settingsVisible` / `sizesAndPackagesVisible`.
  2. **Avatar menu entry order** — insert a new `TouchableOpacity` menu item labeled `Abbreviations` between `Sizes & Packages` and `Sign Out`; tapping closes the avatar menu and opens Abbreviations.
  3. **Conditional render** — render `<Abbreviations visible={abbreviationsVisible} onClose={() => setAbbreviationsVisible(false)} />` with the same conditional style used for Settings and SizesAndPackages.
  4. **Ensure:** keep sign-out flow (`supabase.auth.signOut()`, `queryClient.clear()`, `router.replace('/auth')`), existing menu backdrop/press behavior, and existing menu item labels/order outside the new insertion unchanged.

- `client/app/(tabs)/items.tsx` —
  1. **Alias edit state** — add modal-local state for item aliases: `aliases: string[]`, `newAliasInput: string`, and `showAliasInput: boolean`; initialize from `editingItem.aliases ?? []` in `openModal(item)`, and reset to `[]` + cleared input/visibility in new-item mode.
  2. **"Also known as" UI section** — add section after `Alternate Quantities`, before `Store Preferences`: render alias chips with `×` remove button plus trailing `+ Add alias`; tapping `+ Add alias` shows inline `TextInput`; Return adds trimmed non-empty non-duplicate alias; blur dismisses inline input without adding.
  3. **Save payload + undo snapshot** — include `aliases` in `payload` for `updateItem/createItem`; include original `editingItem.aliases ?? []` in `oldSnapshot` so existing undo registration restores alias edits.
  4. **Active Abbreviations data wiring** — consume `useWordAliases()` and call `useWordAliasesForWords()` helper; build lowercase unique words from `editingItem.name` + current `aliases`; show read-only rows `"{word} → {alias1}, {alias2}"` only for matched words.
  5. **"Active Abbreviations" section** — render after "Also known as" and only when editing existing item; show muted empty state text exactly `No abbreviations defined for this item's words` when no rows.
  6. **"Define Abbreviations" launch** — add state `abbreviationsVisible: boolean` and `abbreviationsInitialSearch: string`; render blue text button `Define Abbreviations` (color `#2563eb`, no background) below Active Abbreviations that opens `<Abbreviations ... initialSearch={abbreviationsInitialSearch} />` with initial search as item words joined by spaces.
  7. **Conditional visibility rules** — ensure Active Abbreviations section and Define Abbreviations button are hidden for new item mode (`editingItem === null`).
  8. **Ensure:** keep existing quantity parse/format flow (`parseQuantityText`, `normalizeQuantityText`), existing store preference editor/dropdowns/comments, category chips, modal save/cancel behavior, and undo label/redo structure untouched except for adding `aliases` fields.

- `client/api/items.ts` —
  1. **MasterItem type extension** — add `aliases: string[]` to `MasterItem` so edit modal data includes alias array strongly typed.
  2. **Update mutation input type** — add optional `aliases?: string[]` to `useUpdateMasterItem` mutation arg destructuring type so `...updates` forwards aliases through `.update(updates)`.
  3. **Query shape note** — `useAllItems` already uses `select(*)` with joins, so `aliases` is already returned from the database. No query change needed — only the TypeScript `MasterItem` type needs updating.
  4. **Ensure:** keep household guard (`if (!householdId) throw new Error('No household ID found')`), existing `item_store_preferences` delete/reinsert behavior, and existing invalidation keys (`['items']`, `['all_items']`, `['master_item_names']`, `['shopping_list']`) unchanged.

- `client/api/aliases.ts` —
  1. **Utility helper** — add `useWordAliasesForWords(words: string[], wordAliasMap: Map<string, string>): Map<string, string[]>` as a pure helper (no query/mutation) that filters alias data to requested canonical words and returns grouped `canonical -> aliases[]`.
  2. **Behavior details** — normalize input words to lowercase, dedupe words, collect all aliases where `wordAliasMap.get(alias) === canonicalWord`, and return deterministic grouped arrays for stable UI rendering/tests.
  3. **Ensure:** do not change existing query keys, CRUD hook signatures, household guards, or mutation invalidation behavior.

## New Files

- `client/components/Abbreviations.tsx` — full-screen modal component with:
  - Header/title `Abbreviations`, close button, and safe-area-aware layout.
  - **State variables** (from spec):
    ```
    viewMode: 'canonical' | 'alias'  (default 'canonical')
    canonicalSearch: string           (default initialSearch ?? '')
    aliasSearch: string               (default '')
    dialogVisible: boolean
    dialogCanonical: string
    dialogCanonicalEditable: boolean
    dialogAliases: string[]
    dialogNewAliasInput: string
    dialogExistingId: string | null
    ```
  - Segmented toggle for `Canonical → Aliases` and `Alias → Canonical` with independent preserved search state (`canonicalSearch`, `aliasSearch`).
  - Search with OR-prefix semantics across whitespace-separated terms.
  - Placeholder rows for unmatched terms in each mode, including unknown-item-word amber (`#f59e0b`) inline warning (`"doesn't appear in any of your items"`).
  - Row tap opens centered-card edit dialog (transparent backdrop, nested pressables).
  - Edit dialog:
    - **Header:** Delete pill (top-left, `Trash2` icon in `#fee2e2` background — only when editing existing), title = canonical word, X close (top-right). Follows §7a modal header pattern.
    - **Canonical word field:** Read-only when editing existing. Editable `TextInput` when creating new.
    - Existing alias chips with remove `×`, add-alias input with lowercase/trim/single-token validation, suggestion chips from `useAbbreviationSuggestions`.
    - **Conflict warnings:**
      - Blocking (red `#991b1b`): duplicate alias key — disables Save.
      - Vocabulary conflict (amber `#f59e0b`): alias matches unit/package/size_descriptor.
      - Item name conflict (amber `#f59e0b`): alias word appears in N items.
      - Unknown canonical word (amber `#f59e0b`): new entry canonical not in any item.
    - Save diff logic (create new/delete removed), and Delete-all-with-confirmation flow for canonical word (inline confirm pattern from VocabularyManagement).
  - `initialSearch` prop behavior: pre-populates canonical search and starts in canonical mode.

- `client/components/__tests__/Abbreviations-test.tsx` — tests for:
  - Rendering/navigation cases: visible true renders modal title + close, visible false renders nothing, toggle segments render, X calls `onClose`.
  - Toggle behavior: defaults canonical view, switches to alias view, preserves independent per-view search state.
  - Search behavior: OR semantics (`chicken breast` matches either), unmatched-term placeholder creation, unknown-word placeholder warning.
  - Edit dialog behavior: row opens dialog, placeholder opens new-entry dialog with editable canonical field, existing chips render/removable, Return adds chip, whitespace invalidation for single-token rule, uppercase input lowercased, suggestions render and tap-add.
  - Conflict warnings: duplicate alias blocking warning disables Save, vocabulary conflict warning, item-name conflict warning with count.
  - CRUD behavior: Save calls create for new chips, Save calls delete for removed chips, Delete flow removes all aliases for canonical word.
  - Item-launch behavior: `initialSearch` pre-populates search and filters visible rows.
  - Required mocks: `@/api/aliases` hooks (`useWordAliases`, `useAbbreviationSuggestions`, create/delete/update mutations), `@/api/items` `useMasterItemNames`, `@/api/vocabulary` `useVocabulary`, safe area provider wrapper, and React Query + household/undo providers where required by hooks.

- `client/app/(tabs)/__tests__/items-alias-test.tsx` — tests for:
  - "Also known as": existing alias chips render, `×` removes chip, `+ Add alias` + Return adds chip, save payload includes updated `aliases`, undo snapshot restores original aliases, new-item modal starts with empty aliases and only `+ Add alias`.
  - "Active Abbreviations": shows rows for matched words, shows empty-state text when none, includes words coming from item aliases, hidden in new-item mode.
  - "Define Abbreviations" button: opens Abbreviations with pre-populated initial search string, hidden in new-item mode.
  - Required mocks: `@/api/items` (`useAllItems`, `useUpdateMasterItem`, `useCreateMasterItem`), `@/api/aliases` (`useWordAliases`), metadata/vocabulary hooks used by modal, undo context `pushAction` capture, and Abbreviations component mock/assertion.

- `client/components/__tests__/UserAvatar-alias-test.tsx` — tests for:
  - Avatar menu includes `Abbreviations` item.
  - Tapping `Abbreviations` opens Abbreviations modal.
  - Menu order is `General`, `Sizes & Packages`, `Abbreviations`, `Sign Out`.
  - Required mocks: household context (`displayName`, avatar data), router/supabase/query client as needed for UserAvatar render, and Abbreviations component visibility assertion.

## Patterns Applying
- Realtime Mutation Tracking: No — F91 changes do not mutate `list_items`; token alias CRUD is against `word_aliases`, item alias edits are `items` updates.
- Household Guard: No (new guard additions) — all touched mutations already guard household in existing hooks (`useUpdateMasterItem`, alias CRUD hooks).
- Undo Registration: Yes — existing `items.tsx` save flow already registers `pushAction`; plan extends `payload` and `oldSnapshot` with `aliases` so undo/redo includes alias edits.

## Ambiguities / Questions
- None
