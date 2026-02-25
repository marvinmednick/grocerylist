# Backlog

Small deferred tasks, cleanup items, and non-blocking findings that don't warrant a full feature spec. Items here are added by Claude during `/spec` (intentional deferrals) and `/review` (non-blocking findings).

When an item grows in scope, promote it to a feature in PLAN.md and open a GitHub Issue.

---

## Deferred from Specs

- [ ] Delete `app/modal.tsx` — dead code after F001 ships; kept for potential future Settings screen reuse. Now that F007 is planned, delete this once F007 ships. (deferred from F001)

## Small Enhancements (from design docs — too small for a full feature spec)

- [ ] Haptic feedback on long press in shopping mode (mobile only) — from `docs/design/list-interactions.md` Future Considerations
- [ ] Auto-mode switching: auto-switch to shopping mode when first item is checked off, back to planning when list is empty — from `docs/design/list-interactions.md` Future Considerations
- [ ] Per-tab mode memory: Items tab could remember its own interaction mode independently — from `docs/design/list-interactions.md` Future Considerations
- [ ] Items tab header consolidation: apply the same `headerShown: false` + custom header treatment to the Items tab — from `docs/design/list-interactions.md`

## Found in Review

- [x] Fix test wrapper in `client/components/__tests__/SmartAddItem-test.tsx` — missing `UndoProvider` and `HouseholdProvider`; current wrapper only has `QueryClientProvider`. (found during /init review) — fixed in B2
- [x] Add missing `UserAvatar-test.tsx` test: `it('uses default color #2563eb when avatarColor is null')` — fixed post-review. (found in F001 review)
- [x] Add missing `UserAvatar-test.tsx` test: `it('closes menu when backdrop is pressed')` — fixed post-review. (found in F001 review)
- [ ] Update `index-interactions-test.tsx` mock for `useHousehold` to include `displayName`, `displayNameShort`, `avatarColor` fields. (found in F001 review)
- [ ] Update `specs/F001-list-interactions.md` Implementation Commands — still references removed `--plan-approved` flag. (found in F001 review)

## Tech Debt

_(none yet)_
