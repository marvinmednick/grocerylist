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

### Scenario 4: The Cleanup Flow (Future)
- **Action:** User has "Milk" (Purchased) and "Bread" (Unpurchased) on the list.
- **Action:** User taps "End Shopping Trip".
- **Expected:** 
  1. Modal asks: "What should we do with Bread?"
  2. User selects "Keep on list".
  3. "Milk" is removed from the active view (moved to history).
  4. "Bread" remains on the active list for the next trip.
