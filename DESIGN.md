# Grocery App Design & Architecture

## 1. Project Overview
**Goal:** A cross-platform (iOS/Android/Web) collaborative shopping list application.
**Core Philosophy:** Real-time synchronization, structured data (Stores/Categories) mixed with flexibility (Custom items), and "Trip" based workflows.
**Stack:**
- **Frontend:** React Native (Expo) + NativeWind (Tailwind).
- **Backend:** Supabase (PostgreSQL + Realtime).
- **State:** React Query (TanStack Query) + Local State for UI.

## 2. Data Architecture (Schema)

To support both the MVP and the Future Features (Recipes, Trips), we use the following relational schema.

### Core Entities
*   **`profiles`** (Users)
    *   `id` (UUID, matches Auth)
    *   `email`
*   **`stores`**: ID, Name, Color.
*   **`categories`**: ID, Name, Sort Order.
*   **`items`** (Master Dictionary)
    *   `id` (UUID)
    *   `name` (Text - Unique)
    *   `default_qty` (Text)
    *   `alternate_qtys` (Array of Strings)
    *   `default_category_id` (FK)
    *   `default_store_id` (FK)

### The Shopping List (Active Data)
*   **`list_items`**
    *   `id` (UUID)
    *   `name`, `quantity` (Snapshots)
    *   `is_purchased` (Boolean)
    *   `purchased_at` (Timestamp - set when checked)
    *   `archived_at` (Timestamp - set when Trip Ends)
    *   `trip_id` (FK -> shopping_trips)

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

### C. Drag and Drop Store Assignment
The shopping list uses a flattened data structure to enable moving items across store boundaries.
- **Trigger:** Long-press on the vertical grip icon (`GripVertical`).
- **Logic:** Upon drop (`onDragEnd`), the system traverses the list upwards from the drop index to find the nearest `header` row.
- **Sync:** The item's `store_id` is updated to match the header found.
- **Undo:** The move registers an action in the `UndoStack` to revert the `store_id` change.

## 4. Feature Definitions

### A. Smart Item Entry (The "Add" Workflow)
**User Story:** "I want to add 'Milk', but I shouldn't have to type it all if the app knows it, and I want to see exactly what is being added."

1.  **Input:** User types "Mil".
2.  **Dropdown Results:** A list of matching items appears below the input.
    *   **Format:** `[Item Name] - [Default Qty] at [Preferred Store]` (e.g., "Milk - 1 gal at Safeway").
3.  **Split Interaction:**
    *   **Quick Add (Tap Left/Main):** Immediately adds the item to the list using the shown defaults. A success toast appears at the bottom.
    *   **Edit Before Add (Tap Right Icon):** Opens an **Inline-Edit Form** above the keyboard.
4.  **Inline-Edit Form:**
    *   **Quantity:** A dropdown pre-filled with "Usual Quantities" (e.g., "1 gal", "1/2 gal"). Includes a manual text entry option.
    *   **Store:** A dropdown pre-filled with "Known Stores" for this item. Includes an "Other..." option to type in a one-off store.
5.  **Completion:** Hitting "Add" from the form or finishing a Quick Add clears the input and keeps the keyboard open for the next item.

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
