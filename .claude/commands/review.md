Review the code changes described or shown (use recent git diff if no specific code is provided): $ARGUMENTS

Check the implementation against the patterns in CODING.md and the architecture in DESIGN.md.

Evaluate each of the following and report pass / fail / not-applicable with a brief explanation:

**Realtime Mutation Tracking**
- Do all list_items writes wrap the Supabase call with incrementLocalMutation() / decrementLocalMutation() in a try/finally?

**Household Guard**
- Do all inserts into household-scoped tables (items, item_stores, list_items, shopping_trips) check `if (!householdId) throw` before the Supabase call?
- Is `household_id: householdId` included in the insert payload?

**Undo Registration**
- Does every user-initiated mutation on the shopping list screen call pushAction with a label, undo fn, and redo fn?
- Does the screen use mutateAsync (not mutate) where the returned id is needed for undo?
- **Stale ID check (Failure Mode A):** If redo re-creates a row (re-insert after delete, re-end-trip), is the new ID tracked via a mutable object (`tracker.currentId`) rather than a closed-over variable?
- **Field snapshot check (Failure Mode B):** For each pushAction, does the undo closure capture every field it needs to restore? Any field the mutation overwrites (e.g., `purchased_by`, `store_id`) must be read from the item *before* the mutation fires, not inside the closure. Multi-field edits should snapshot the full relevant row slice.

**React Query Invalidation**
- Are the correct query keys invalidated after each mutation?
- Are any unnecessary keys being invalidated?

**Styling**
- Does the code use StyleSheet.create() only? No NativeWind className props?

**Platform Compatibility**
- Are any Alert.alert() calls guarded with Platform.OS === 'web'?

**TypeScript**
- Are new Supabase row shapes defined as interfaces in the api/ file?
- Are there any unsafe `as any` casts in api/ files?

**Supabase Query Shapes**
- Do joins use the `!foreign_key_name` syntax where needed?
- Does any active list query include `.is('archived_at', null)`?

**Architecture Boundaries**
- Is business logic in api/ files rather than screen components?
- Were any patterns changed that require a design decision (new context providers, RLS changes, undo system changes, trip workflow changes)?

**Database Schema / Migration Status**
- Does the spec's "Database / Schema Changes" section list any new migrations? If none, mark not-applicable.
- If new migration files are present, run `supabase migration list` from the project root and verify every new migration file appears as **applied** in the output.
- If any new migration is listed as pending (or absent), this is a **blocking** finding — all Jest tests mock Supabase and will pass regardless, but the app will fail at runtime until the migration is applied.
- List the migration filename(s) and their applied/pending status in the report.

**Test Coverage**
- Does every item in the spec's Acceptance Criteria have a corresponding test?
- Is there a test verifying the household guard throws when householdId is null (for any new inserts)?
- Is there a test verifying pushAction is called with the correct label (for any new list mutations)?
- Do tests use the full three-provider wrapper (QueryClientProvider + UndoProvider + HouseholdProvider)?
- Do all tests pass? (`npm test` from client/)

**Summary**
Provide an overall assessment and a prioritized list of issues to fix, separated into:
- Blocking (must fix before use — includes any failing tests)
- Non-blocking (should fix but won't break things)
- Suggestions (optional improvements)

## After the review:

**Update the GitHub Issue:**
If a feature ID is known (from the spec or $ARGUMENTS), run:
```bash
gh issue comment [N] --body "## Review complete\n**Result:** [Pass/Needs fixes]\n\n**Blocking:**\n[list]\n\n**Non-blocking:**\n[list]"
```
If review passes, add the `in-review` label and note it's ready to merge:
```bash
gh issue edit [N] --add-label "in-review"
```

**Append non-blocking items to BACKLOG.md:**
For each non-blocking finding and suggestion, append to BACKLOG.md under "Found in Review":
```
- [ ] [Description] — (found in F[N] review)
```

**Update PLAN.md status:**
If the implementation passed review, update the feature's Status column from `In Progress` to `In Review`.
If it needs fixes, keep it as `In Progress`.
