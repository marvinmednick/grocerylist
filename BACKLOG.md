# Backlog

**This is a short-lived inbox, not a permanent list.** Items land here during `/spec` and `/review` when it's not the right moment to stop and handle them. After every feature ship or bug fix commit, triage this file: fix items now, promote them to GitHub Issues, or discard them. The goal is an empty backlog after each triage.

See WORKFLOW.md §8 (Backlog Triage) for the full process.

---

## Found in Review

- [ ] `HouseholdMember.display_name_short` typed as `string` but DB column is nullable — should be `string | null` — (found in F2 review)
- [ ] `HouseholdMember.display_name` typed as `string` but DB column is nullable — should be `string | null` — (found in F2 review)
- [ ] No test for global "End All" button triggering multi-user modal when multiple purchasers are present — (found in F2 review)

## Deferred from Specs

- [ ] "Your trips" vs "All trips" filter toggle in History — display works; filter UI is a future F9 enhancement. (deferred from F2)
- [ ] Per-user shopping analytics (who buys what most often) — deferred to a future analytics feature. (deferred from F2)
- [ ] Household member list in Settings — F7 shows household name but not member list with colors; full member management is a future feature. (deferred from F2)
- [ ] Null `purchased_by` items in multi-user modal path — pre-migration items remain in purchased-but-not-archived state until a single-user end trip runs; acceptable for V1. (deferred from F2)
