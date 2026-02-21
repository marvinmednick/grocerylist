Produce a structured implementation spec for Gemini to implement the following feature: $ARGUMENTS

Read the relevant sections of DESIGN.md and any applicable docs/design/ files before writing the spec.

The spec must include all of the following sections (omit any that genuinely don't apply, but err toward inclusion):

## Feature: [name]

### Context
Brief explanation of what this feature does and which user scenario it addresses. Reference USER_SCENARIOS.md or DESIGN.md if relevant.

### Files to Modify
List each file and what changes are needed (add a function, modify a query, add UI state, etc.). Be specific about which existing functions/hooks are touched.

### New Files (if any)
Name, location, and purpose of any new files.

### Database / Schema Changes
Any new columns, tables, or indexes required. If none, state "None."
Note: Gemini should not implement schema changes without a migration file being specified.

### Supabase Query Shapes
Provide the exact `.select()` string for any new queries, including join syntax. Reference the `!foreign_key_name` pattern where a table has multiple FKs to the same target.

### React Query Keys
List any new query keys to introduce. Confirm which existing keys need invalidation after mutations.

### Undo/Redo Registration
For each user-initiated mutation, specify:
- The `label` string
- What the `undo()` function does
- What the `redo()` function does

### Household Scoping
Confirm which new inserts require the household guard (`if (!householdId) throw`), and which new inserts need `household_id: householdId` included.

### Realtime Mutation Tracking
Confirm whether `incrementLocalMutation` / `decrementLocalMutation` wrapping is required (required for all list_items writes).

### Platform Considerations
Note any Alert/dialog patterns that need the `Platform.OS === 'web'` guard.

### Acceptance Criteria
Bullet list of observable behaviors that confirm the feature is working correctly.

### Tests to Write
List the specific test cases Gemini must implement. For each test, specify:
- The file to create or add to (e.g., `components/__tests__/FeatureName-test.tsx`)
- The test description (the `it('...')` string)
- What to assert

Always include tests for:
- Each item in Acceptance Criteria that can be verified programmatically
- Household guard (if any new inserts are added): mutation throws when householdId is null
- Undo registration (if applicable): `pushAction` is called with the correct label
- Realtime tracking (if applicable): `localMutationCount` is managed around mutations

Example format:
```
File: components/__tests__/FeatureName-test.tsx
- it('renders X when Y') → assert element is present
- it('calls pushAction with label "Added X" after adding') → mock pushAction, trigger action, assert call
- it('throws when householdId is null') → mock null household, assert rejection
```

### What Gemini Should NOT Change
List any files or patterns that are out of scope for this implementation.
