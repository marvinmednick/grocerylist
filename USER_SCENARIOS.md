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

### Scenario 3: Real-time Collaboration
- **Action:** User A and User B are both looking at the same Shopping List.
- **Action:** User A checks the box for "Apples".
- **Expected:** User B sees the "Apples" row cross out and move (if sorting is enabled) instantly without refreshing.

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
