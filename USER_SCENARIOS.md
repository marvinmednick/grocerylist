# User Scenarios & Test Cases

These scenarios define the expected behavior of the application and should be used for manual/automated testing.

### Scenario 1: Adding a Common Item (Quick Add)
- **Pre-condition:** "Milk" exists in Master DB with default store "Safeway".
- **Action:** User types "Mi" in the search bar.
- **Expected:** "Milk - 1 gal at Safeway" appears in the dropdown.
- **Action:** User taps the main text area of the "Milk" row.
- **Expected:**
  1. Dropdown closes.
  2. Input clears.
  3. "Milk" appears in the "Safeway" section of the shopping list.
  4. Real-time: The item appears on other logged-in devices.

### Scenario 2: Adding a Brand New Item (Save to DB)
- **Pre-condition:** "Dragonfruit" does NOT exist in the database.
- **Action:** User types "Dragonfruit".
- **Expected:** "Add 'Dragonfruit' (One-time)" appears in the dropdown.
- **Action:** User taps the **Chevron/Edit icon** on the right side of the dropdown.
- **Expected:** "Edit Details" modal opens.
- **Action:** User selects "Produce" category and "Whole Foods" store. Taps "Add to List".
- **Expected:** 
  1. "Dragonfruit" is added to the list under "Whole Foods".
  2. "Dragonfruit" is now available in the "Items" tab and for future autocomplete.

### Scenario 3: Real-time Collaboration with Toast Notifications
- **Pre-condition:** User A and User B are in the same household (default in single-household mode).
- **Action:** User A and User B are both looking at the same Shopping List.
- **Action:** User A adds "Apples" to the list.
- **Expected:**
  1. User A sees "Apples" appear — no toast notification (local mutation suppressed).
  2. User B sees "Apples" appear and a toast notification: "Apples was added to the list".
  3. The toast auto-dismisses after 3 seconds.
- **Action:** User A checks the box for "Apples".
- **Expected:** User B sees "Apples" cross out and a toast: "Apples was updated".

### Scenario 4: The Cleanup Flow (Store Specific)
- **Action:** User has "Milk" (Purchased) and "Bread" (Unpurchased) under Safeway.
- **Action:** User taps "End Trip" in the Safeway header.
- **Expected:** 
  1. Confirmation dialog appears.
  2. "Milk" is removed from the active view (`archived_at` set).
  3. "Bread" remains on the active list.
  4. An "Undo" badge increment appears at the top.

### Scenario 5: Global Undo
- **Action:** User accidentally deletes "Eggs" from the list via the trash icon.
- **Action:** User taps the Undo button (RotateCcw icon) in the main header.
- **Expected:** 
  1. "Eggs" reappears in the list with all original details (Qty, Store).
  2. The undo badge decrement happens.

### Scenario 6: In-List Editing
- **Action:** User taps the text "Milk - 1 gal".
- **Expected:** "Edit Item" modal opens.
- **Action:** User changes quantity to "2 gal" and taps "Save Changes".
- **Expected:** List updates immediately to show "Milk - 2 gal".
- **Action:** User clicks Undo.
- **Expected:** List reverts back to "Milk - 1 gal".

### Scenario 7: Drag and Drop Store Change
- **Action:** User long-presses the grip icon next to "Milk" (currently under Safeway) and drags it under the "Costco" header.
- **Expected:** 
  1. The item stays under Costco.
  2. Database: `store_id` for "Milk" updates to Costco's ID.
  3. UI: The Undo badge increments.
- **Action:** User clicks Undo.
- **Expected:** "Milk" moves back to the Safeway section.

### Scenario 8: Redo Action
- **Action:** User adds "Cheese" to the list.
- **Action:** User clicks Undo.
- **Expected:** "Cheese" is removed.
- **Action:** User clicks Redo (RotateCw icon).
- **Expected:** "Cheese" reappears on the list.

### Scenario 9: Duplicate Entry Handling
- **Pre-condition:** "Ground Beef" is already on the list for Safeway.
- **Action:** User types "Grou" and selects "Ground Beef" for Safeway again.
- **Expected:** 
  1. A prompt appears: "Ground Beef is already on your Safeway list. What would you like to do?"
  2. Options: "Update Quantity", "Add Duplicate", "Cancel".
- **Action:** User selects "Add Duplicate".
- **Expected:** A second "Ground Beef" entry appears in the Safeway section.

### Scenario 10: Quantity Units Selection
- **Pre-condition:** "Ground Beef" has default unit "lbs".
- **Action:** User edits "Ground Beef" in the shopping list.
- **Expected:** 
  1. The quantity input shows the current value (e.g., "1").
  2. A unit picker shows "lbs" as selected.
- **Action:** User types "2-3" in the value field and selects "packages" in the unit picker. Taps Save.
- **Expected:** The list displays "Ground Beef - 2-3 packages".

### Scenario 11: New User Signup (Single Household Mode)
- **Pre-condition:** `EXPO_PUBLIC_HOUSEHOLD_MODE=single`. A default household exists in the database.
- **Action:** User creates a new account via the Sign Up form.
- **Expected:**
  1. A `profiles` row is created linking the user to the default household.
  2. User is redirected to the shopping list.
  3. User sees all items shared by other household members.

### Scenario 12: Existing User Sign-In (Profile Backfill)
- **Pre-condition:** A user existed before the household migration and has no `profiles` row.
- **Action:** User signs in with their existing credentials.
- **Expected:**
  1. A `profiles` row is automatically created, assigning the user to the default household.
  2. User sees all their existing data (items, list items) which were backfilled to the default household.

### Scenario 13: Sign Out and Sign In (Cache Clearing)
- **Action:** User signs out via the Settings modal.
- **Expected:**
  1. All cached data (household_id, shopping list, items) is cleared.
  2. User is redirected to the auth screen.
- **Action:** User signs back in.
- **Expected:** Household ID is re-fetched. Shopping list loads fresh data for their household.
