# Project Review Checklist

This file is read by `/review-impl` (and the built-in `/review`) to evaluate implementations against
project-specific patterns. Each item below is checked and reported as pass / fail / not-applicable.

---

**Realtime Mutation Tracking**
- Do all list_items writes wrap the Supabase call with incrementLocalMutation() / decrementLocalMutation() in a try/finally?

**Household Guard**
- Do all inserts into household-scoped tables (items, item_store_preferences, list_items, shopping_trips, stores) check `if (!householdId) throw` before the Supabase call?
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
- Do all tests pass? (Run `./check-tests --show-known` from project root)
- Are there zero skipped tests? (`it.skip` and `describe.skip` are not acceptable in delivered code — each is an untested requirement. If `check-tests` reports skips, this is blocking.)

**Timer Hygiene** (flake prevention)
- Does every test that calls `jest.useFakeTimers()` have a matching `jest.useRealTimers()` in `afterEach` (not just inline at the end of the test)?
- Do any tests use hardcoded `setTimeout` sleeps as workarounds? (These mask leaked state — flag as blocking.)
- Do tests that check realtime toast behavior (`localMutationCount === 0`) call `__resetLocalMutationCount()` in `beforeEach`?

**When a test fails then passes on re-run:**
Do not dismiss it. A test that fails once and passes once is evidence of a real problem. Follow this procedure:
1. **Log it** — append an entry to `docs/flaky-test-log.md` with the date, test name, error message, and whether it was investigated or deferred.
2. **Categorize** — is the failure environmental (SIGSEGV, worker crash, network timeout) or code-related (act() warning, assertion intermittently wrong, state leak)?
3. **Investigate code-related flakes immediately** — these are blocking. Common root causes: fake timer leaks, module-level state (`localMutationCount`), missing `await` on async operations, React Query `notifyManager` scheduling.
4. **Note environmental flakes but don't block on them** — log the occurrence for pattern tracking. If the same environmental failure recurs across multiple reviews, escalate to investigate the environment.
