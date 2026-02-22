# Backlog

Small deferred tasks, cleanup items, and non-blocking findings that don't warrant a full feature spec. Items here are added by Claude during `/spec` (intentional deferrals) and `/review` (non-blocking findings).

When an item grows in scope, promote it to a feature in PLAN.md and open a GitHub Issue.

---

## Deferred from Specs

- [ ] Delete `app/modal.tsx` — dead code after F001 ships; kept for potential future Settings screen reuse. (deferred from F001)

## Found in Review

- [ ] Fix test wrapper in `client/components/__tests__/SmartAddItem-test.tsx` — missing `UndoProvider` and `HouseholdProvider`; current wrapper only has `QueryClientProvider`. (found during /init review)

## Tech Debt

_(none yet)_
