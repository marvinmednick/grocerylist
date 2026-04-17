# Flaky Test Log

Track intermittent test failures here. Each entry records what failed, why, and whether it was resolved or is environmental noise. Patterns across entries reveal systemic issues.

---

### 2026-04-16 — index-f103-test.tsx: end-trip archives matching entries
- **Error:** `Unexpected console.error: An update to %s inside a test was not wrapped in act(...)`
- **Category:** Code — React Query `notifyManager` timer leak
- **Investigation:** TanStack Query's `notifyManager` uses `setTimeout` to batch state updates. When the timer fires after the test's `act()` boundary, React emits `console.error`, which `jest.setup.js` turns into a hard failure. Intermittent because it depends on whether the timer fires before or after the test completes.
- **Resolution:** Added `notifyManager.setScheduler(cb => cb())` to `jest.setup.js` to make all React Query notifications synchronous in tests. Also added `jest.useRealTimers()` to `afterEach` in test files using fake timers, and `__resetLocalMutationCount()` to reset module-level state between tests.

### 2026-04-16 — items-test.tsx: Test suite failed to run
- **Error:** `A jest worker process (pid=20413) was terminated by another process: signal=SIGSEGV, exitCode=null`
- **Category:** Environmental — worker process crash
- **Investigation:** SIGSEGV in a Jest worker, not reproducible on immediate re-run. No code change involved.
- **Resolution:** None needed — passed on re-run. Monitor for recurrence.
