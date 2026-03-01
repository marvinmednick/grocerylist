# Backlog

**This is a short-lived inbox, not a permanent list.** Items land here during `/spec` and `/review` when it's not the right moment to stop and handle them. After every feature ship or bug fix commit, triage this file: fix items now, promote them to GitHub Issues, or discard them. The goal is an empty backlog after each triage.

See WORKFLOW.md §8 (Backlog Triage) for the full process.

---

## Test Hygiene

- [ ] `app/(tabs)/__tests__/index-interactions-test.tsx` uses a module-level `QueryClient` singleton with no `afterEach` teardown — same async leak pattern fixed in `SmartAddItem-test.tsx`. Move to `beforeEach`/`afterEach` with `queryClient.clear()`.

## Found in Review

- [ ] `Settings.tsx` has undocumented `renderInline` prop outside spec; Settings tests never exercise the Modal-wrapped code path — consider removing the prop and using a proper Modal wrapper in tests. (found in F7 review)
- [ ] "Settings appears above Sign Out" ordering not asserted in tests — only presence is verified. (found in F7 review)

---

## Deferred from Specs

- [ ] Visual dark theme implementation (color token refactor) — tracked as F10 (#27). (deferred from F7)
- [ ] Household member list in Settings — deferred until F2 (multi-user) advances. (deferred from F7)
