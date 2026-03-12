Diagnose and propose fixes for pre-existing test failures so the baseline can be kept clean.

## Setup

Run the test suite and read the output:

```bash
./check-tests --show-known --show-all
```

Also read `client/known-test-failures.txt` to understand what is already acknowledged.

## Triage

For each unexpected failure (anything NOT in `known-test-failures.txt`), categorize it as one of:

- **Fix** — a genuine bug that should be corrected (missing provider wrapper, wrong mock, broken
  import, etc.). Describe the root cause and the proposed fix.
- **Add to known list** — a pre-existing issue that is out of scope for the current work and
  acceptable to defer. Explain why it is acceptable to defer and what the eventual fix would be.
- **Escalate** — the failure reveals a spec gap or architectural issue that needs Claude/user
  design input before any code can be written.

For each known failure (already in `known-test-failures.txt`), check whether it can now be fixed.
If so, propose it as a **Fix** and plan to remove it from the known list after fixing.

## Propose — THEN STOP

Present your full diagnosis to the user as a numbered list:

```
1. [Fix] components/__tests__/SmartAddItem-test.tsx | SmartAddItem › renders the search input
   Root cause: Component calls useUndo() but test doesn't wrap with UndoProvider.
   Fix: Wrap render call in <UndoProvider> in SmartAddItem-test.tsx.

2. [Add to known] lib/__tests__/household-test.tsx | useHousehold › exposes profile fields
   Reason: household.tsx hasn't been updated for F1 yet; will be fixed during F1 implementation.
   Entry to add to known-test-failures.txt: ...

3. ...
```

**DO NOT write any code or edit any files until the user approves the proposal.**

Ask: "Does this diagnosis look right? Should I proceed with these actions?"

## After approval

Once the user approves:

1. For each **Fix** item:
   - If the fix is small (1–3 lines, no architectural implications), apply it directly with Edit.
   - If the fix requires an aider session (multi-file or complex), invoke aider with `--implement-only`
     to make the fix without triggering the auto-test loop, then run `./check-tests` to verify.
   - Remove the entry from `client/known-test-failures.txt` if it was previously known.

2. For each **Add to known list** item:
   - Append the entry to `client/known-test-failures.txt` in the correct format:
     ```
     # <reason for deferring — one line>
     [SUITE] <suite-path> | <test-name>
     ```
   - Include today's date as a comment on the line above.

3. For each **Escalate** item:
   - File a note in `BACKLOG.md` under a "Test Infrastructure" heading describing the issue.
   - Do not attempt to fix it.

4. Run `./check-tests` after all changes and confirm:
   - Exit code 0 (no unexpected failures), OR
   - All remaining failures are now in `known-test-failures.txt`

## Done

Report:
- What was fixed (file and change summary)
- What was added to the known list (with rationale)
- What was escalated to BACKLOG.md
- Final `./check-tests` output
