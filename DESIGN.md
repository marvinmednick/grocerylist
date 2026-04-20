# Grocery App Design & Architecture

> **Related docs:** `docs/design/ui-guidelines.md` — visual and interaction patterns (component selection, established conventions, TBD placeholders, decision log). Read alongside this file before designing any feature with a UI component.
> `docs/design/vocabulary-and-quantity-architecture.md` — cross-cutting architecture for vocabulary tables, quantity storage, and input interpretation. Umbrella doc for F44, F77, F78, F79.

## 1. Project Overview
**Goal:** A cross-platform (iOS/Android/Web) collaborative shopping list application.
**Core Philosophy:** Real-time synchronization, structured data (Stores/Categories) mixed with flexibility (Custom items), and "Trip" based workflows.
**Stack:**
- **Frontend:** React Native (Expo). NativeWind is installed but **not used** — all styling uses `StyleSheet.create()` exclusively.
- **Backend:** Supabase (PostgreSQL + Realtime).
- **State:** React Query (TanStack Query) + Local State for UI.

## 2. Data Architecture (Schema)

To support both the MVP and the Future Features (Recipes, Trips), we use the following relational schema.

### Household & User Entities
*   **`households`**: ID, Name. The top-level grouping for shared data. All user-scoped tables reference a `household_id`. In single-household mode (`EXPO_PUBLIC_HOUSEHOLD_MODE=single`), all users join one default household. In multi-household mode, each user gets their own on signup.
*   **`profiles`**: ID (matches `auth.users.id`), `household_id` (FK), `display_name`, `display_name_short`, `color`, `warning_preferences` (JSONB — per-user control over which warning types are shown). Created during signup/first sign-in via application code in `client/app/auth.tsx`. Short name and color are used for multi-user check-off indicators. See `docs/design/F2-multi-user-trips.md`.

### Core Entities
*   **`stores`**: ID, Name, `color_code`. (Household-scoped — each household manages its own store list. Added/edited/deleted via the Store Management UI, F19.)
*   **`categories`**: ID, Name, Sort Order. (Global.)
*   **`units`**: ID, Name, Abbreviation. (Global.)
*   **`items`** (Master Dictionary)
    *   `id` (UUID)
    *   `name` (Text - Unique per household: `UNIQUE(name, household_id)`)
    *   `short_name` (Text, optional — abbreviated display name for dense list rows)
    *   `default_qty` (Text)
    *   `alternate_qtys` (Array of Strings)
    *   `default_category_id` (FK)
    *   `household_id` (FK -> households)
*   **`item_store_preferences`** (Many-to-Many, household-scoped): `item_id`, `store_id`, `status` (`preferred` | `avoided` | `unavailable` | `neutral`), `comment`, `household_id`. Replaces the former `item_stores` table. Drives warning badges on list items when the active store doesn't match preferences.

### The Shopping List (Active Data)
*   **`list_items`** (parent — per-item fields)
    *   `id` (UUID)
    *   `item_id` (FK -> items, nullable — `null` means one-off item not in master dictionary)
    *   `store_id` (FK -> stores, nullable)
    *   `name` (Snapshot)
    *   `category_id` (FK -> categories, nullable)
    *   `warnings` (JSONB array — computed from `item_store_preferences` at add time; drives `WarningBadge` display)
    *   `match_metadata` (JSONB — parser match info from Smart Add)
    *   `added_at`, `added_by` (UUID -> auth.users.id)
    *   `archived_at` (Timestamp — set when last child entry is archived)
    *   `household_id` (FK -> households)
*   **`list_item_quantities`** (child — per-quantity-entry fields, FK to `list_items` ON DELETE CASCADE)
    *   `id` (UUID)
    *   `list_item_id` (FK -> list_items)
    *   `quantity` (Text), `quantity_parsed` (JSONB)
    *   `is_purchased` (Boolean)
    *   `purchased_at`, `purchased_by` (UUID -> auth.users.id)
    *   `archived_at` (Timestamp — set when Trip Ends)
    *   `trip_id` (FK -> shopping_trips)
*   **`shopping_trips`**: `id`, `started_at`, `ended_at`, `primary_store_id`, `status`, `household_id`.

## 3. Core System Patterns

### A. The Command Pattern (Undo System)
The app maintains a global `UndoStack` (React Context) containing the last 100 user actions. 
- **Registration:** Every mutation (Add, Delete, Edit, Toggle) pushes an `UndoableAction` object.
- **Payload:** Each action contains a `label` and an `undo()` function which contains the inverse Supabase logic.
- **Persistence:** Undo persists through navigation but resets on app refresh (session-based).

### B. Multi-Tier Archiving (Trips)
Items move through three states:
1.  **Active:** `is_purchased = false`.
2.  **Purchased:** `is_purchased = true`. Visible but crossed out. `purchased_at` is set.
3.  **Archived:** `archived_at` IS NOT NULL. Hidden from active list. Linked to a `trip_id`.

When an item is checked off, `purchased_by` is set to the current user. Check-off icons are color-coded per user (color from `profiles.color`), making it visible at a glance who is buying what. See `docs/design/F2-multi-user-trips.md` for the full multi-user trip design.

**Multi-User End Trip Logic:**
- Active trips are inferred from distinct `(store_id, purchased_by)` combinations on purchased, non-archived items.
- **One user at a store →** End Trip works as before, no dialog.
- **Multiple users at a store →** Dialog shows each user's trip with item count; user selects which to end.

### C. Drag and Drop Store Assignment
The shopping list uses a flattened data structure to enable moving items across store boundaries.
- **Trigger:** Long-press on the vertical grip icon (`GripVertical`).
- **Logic:** Upon drop (`onDragEnd`), the system traverses the list upwards from the drop index to find the nearest `header` row.
- **Sync:** The item's `store_id` is updated to match the header found.
- **Undo:** The move registers an action in the `UndoStack` to revert the `store_id` change.

### D. Duplicate Entry Handling (F78)
When any add path in `SmartAddItem` fires, `findDuplicate()` (`lib/duplicateDetection.ts`) checks the active list before the mutation.
- **Match Criteria:** Same `item_id` for master items; case-insensitive trimmed name for one-offs (`item_id === null`). Archived entries are excluded.
- **State classification:** `classifyDuplicateState()` returns `same-store-active`, `same-store-purchased`, `cross-store-active`, or `cross-store-purchased`, which drives the action set shown in the dialog.
- **Resolution dialog:** `DuplicateResolutionDialog.tsx` — bottom-anchored modal presenting:
  - **Combine** — sum or multipack options (computed by `combineQuantities()` in `lib/quantityFormat.ts`); calls `useAddQuantityEntry` to insert a new `list_item_quantities` row under the existing parent
  - **Add New** — same-store: add entry under existing parent; cross-store: create a new parent via `useAddToList`
  - **Custom** — inline text input replacing the Combine section; accepts any quantity string
  - **Cancel** — dismisses dialog and restores the saved search query
- **"on list" indicator:** SmartAddItem dropdown rows show muted gray "on list" text for items already on the active list (passive, single state regardless of active/purchased).
- **Undo:** All resolution paths register a full undo action via `pushAction()`.

### E. Household-Scoped RLS
All user-generated data (items, item_store_preferences, list_items, shopping_trips, stores) is scoped to the user's household via Row Level Security.
- **Helper Function:** `get_my_household_id()` — a `SECURITY DEFINER` SQL function that looks up `profiles.household_id` for the current `auth.uid()`.
- **Policy Pattern:** Every policy on household-scoped tables uses `household_id = get_my_household_id()` in both `USING` and `WITH CHECK` clauses.
- **Global Tables:** `categories`, `units`, and `households` remain globally readable by all authenticated users. Note: `stores` are **household-scoped** (each household manages its own store list).
- **Client Guard Pattern:** `HouseholdProvider` (`lib/household.tsx`) fetches `householdId` once per session (`staleTime: Infinity`). Mutations that require `household_id` throw early if it's null. The UI disables add/end-trip controls while the household is loading to prevent race conditions.

### F. Realtime Toast Notifications
When another household member modifies the shopping list, the app shows a toast notification.
- **Local Mutation Tracking:** A module-level counter (`localMutationCount`) in `api/list.ts` increments before each mutation and decrements 500ms after. This prevents self-triggered toasts.
- **Remote Change Detection:** The Supabase realtime channel callback checks `localMutationCount === 0` before invoking the `onRemoteChange` callback.
- **Toast Component:** `components/Toast.tsx` — an absolutely positioned, animated (fade in/out) notification at the bottom of the screen that auto-dismisses after 3 seconds.

### G. Quantity and Input Parsing System

> **Full architecture:** `docs/design/vocabulary-and-quantity-architecture.md`

Free-form text in SmartAddItem is parsed by a multi-pass pipeline (`lib/parser.ts`) that extracts structured fields:

- **Vocabulary** (`lib/vocabulary.ts`): In-memory constants for units (oz, lb, gal…), package types (can, bottle, loaf…), and size descriptors (large, small…). F79 will move these to household-scoped DB tables.
- **Parser passes:** tokenize → classify → group (iterative: QUANTITATIVE_SIZE, SIZED_PACKAGE, COUNT, N-pack) → assemble candidate → name resolution (Pass 5)
- **Name resolution:** Bag-of-words exact matching against `useMasterItemNames()` (lightweight hook, no limit, staleTime 5 min). When no exact match, word-level prefix fallback activates: each name token must be a prefix of at least one word in the item name, enabling "chick" → Chicken Breast and "bone" → Organic Bone Broth.
- **Output:** `ParseResult { interpretations: ParsedInput[], rawInput }` — ranked by matched item name length (longer = more specific, sorts first)
- **Quantity format:** Single natural-language string used for both display and storage (e.g., `"2 8oz cans"`). `quantityEquals(a, b, vocabulary)` parses both sides for semantic comparison. `isPartialMatch` is a raw prefix check for pill sort ordering.

The parser is a pure function (no React hooks) — `parseInput(input, vocabulary, masterItems)` — so vocabulary source is swappable without touching the parser.

## 4. Feature Definitions

### A. Smart Item Entry (The "Add" Workflow)
**User Story:** "I want to add 'Milk', but I shouldn't have to type it all if the app knows it, and I want to see exactly what is being added."

1.  **Input:** User types freely (e.g., "2 milk", "chick", "1.5 lb chicken @costco"). The parser runs on every keystroke.
2.  **Dropdown Results:** Parser-driven result rows appear, one per interpretation:
    *   **Qty pills:** default_qty + alternate_qtys shown as pills; parsed quantity pre-selected (or added as extra pill if not in defaults). Pills sorted partial-match-first. "Other" replaces pills with inline text input.
    *   **Store pills:** appear only when `@hint` is present; live-updated prefix matches.
    *   **Orphan tokens:** unrecognized words shown struck-through next to the item name.
    *   **One-off row:** always available at the bottom using the full raw input text.
3.  **Quick Add (Tap item name row):** Adds using the currently selected qty/store pills.
4.  **Edit Before Add (Tap `›` icon):** Opens edit modal with qty pre-filled from parsed value, store list filtered by @hint with `▸ More` to expand.
5.  **Completion:** Tapping a result row clears the input and keeps keyboard open.

### B. Recipe Import (The "Drafting" Workflow)
**User Story:** "I want to cook Chili, so I add the Chili recipe, but I already have onions."

1.  **Selection:** User picks "Chili" from Recipe list.
2.  **Staging Modal:** App presents a list of all ingredients in "Chili".
    *   [x] Ground Beef (1 lb)
    *   [x] Beans (2 cans)
    *   [x] Onions (1)
3.  **Modification:** User unchecks "Onions". User taps "Ground Beef" and changes quantity to "2 lbs".
4.  **Commit:** User hits "Add to List". App inserts the checked items into `list_items`.

### C. The Shopping Mode (Trips)
**User Story:** "I am at the store now. I want to focus on buying."

1.  **Start Trip:** User toggles "Shopping Mode". List filters to show *only* unpurchased items for the current Store (optional filter).
2.  **Action:** Checking an item moves it to "Cart" (visually distinct).
3.  **End Trip:**
    *   App asks: "You have 3 unpurchased items. Did you buy them?" (Cleanup flow).
    *   Options: "Keep on list", "Mark as bought", "Delete".
    *   System timestamps all `purchased_at` fields and archives the "Trip".

### D. Refined Workflow 3: Adding a Brand New Item
**Scenario:** You type "Dragonfruit", which is not in your database.

1.  **Input:** You type "Dragonfruit".
2.  **Dropdown:** Since there are no matches, the dropdown shows a special "Create Row" section at the bottom.
3.  **Split Interaction:**
    *   **Tap (Main Area - "Add One-time"):** Adds "Dragonfruit" to the current list immediately as a "One-off" item. It is **NOT** saved to the master `items` database. (Perfect for vacation items or rare needs).
    *   **Tap (Right Icon - "Save/Edit"):** Opens the **Inline-Edit Form**.
        *   *Form:* Allows you to set a Category (Produce) and Default Store.
        *   *Action:* Clicking "Save" here adds it to the list **AND** saves it to your master `items` database for future auto-completion.

### E. Refined Workflow 4: Fuzzy Matching & Filtering
**Scenario:** You type "Bana".

**Dropdown Structure (Grouped List):**
The results are visually separated into sections to distinguish high-confidence matches from guesses.

1.  **Section 1: "Best Matches" (Strict Prefix)**
    *   Shows items starting with "Bana".
    *   *Example:* `Banana (Produce)`, `Banana Bread (Bakery)`.
2.  **Section 2: "Did you mean?" (Fuzzy Matches)**
    *   Shows items that are close (Levenshtein distance) but don't start with the prefix.
    *   *Constraint:* Only shown if query length >= 3 chars to avoid noise.
    *   *Example:* `Bandana (Household)` (if applicable).
3.  **Section 3: "Create New"**
    *   Always available at the bottom.
    *   `Add "Bana" (One-time)` | `[Edit Icon]` (to Create in DB).

## 4. MVP Scope (Phase 1)
To get started, we will implement:
1.  **Database:** `items`, `stores`, `categories`, `list_items`.
2.  **UI - List:** View items grouped by Store. Checkbox to mark purchased.
3.  **UI - Add:** Text input with basic autocomplete (querying `items`).
4.  **Sync:** Real-time updates via Supabase.

## 5. Data Strategy & Scalability

### Single Table Architecture
We will store both **Active** and **History** (purchased) items in the single `list_items` table.
*   **Justification:** A family buying 100 items/week generates only ~50k rows in 10 years. PostgreSQL handles millions of rows effortlessly.
*   **Mechanism:** Items are differentiated by the `is_purchased` boolean and `purchased_at` timestamp.
*   **Benefit:** Simplifies "Un-checking" items (no table migration needed) and running analytics.

### Handling "One-Off" vs. "Master" Items
*   **Master Items (`items` table):**
    *   Permanent, reusable dictionary entries (e.g., "Milk").
    *   Have a UUID (`id`) and link to default Categories/Stores.
    *   Used for auto-complete.
*   **One-Off Items (`list_items` row with `item_id = NULL`):**
    *   Created when a user adds something that doesn't exist in the DB (e.g., "Sunscreen" on vacation) and chooses "Add One-time".
    *   **Persistence:** These records remain in the `list_items` table even after purchase, forming part of the "Purchase History".
    *   **Retrieval:** They do not appear in standard auto-complete, but can be found in "History Search" if the user wants to re-add them or convert them to a Master Item later.
