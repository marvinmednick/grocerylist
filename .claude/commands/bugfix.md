Investigate and fix a bug. Input ($ARGUMENTS) is either a GitHub issue number (e.g. `42`)
or a plain-text description of the behavior (a new issue will be created first).

## Setup

**If $ARGUMENTS is a number** — fetch the existing issue:
```bash
gh issue view $ARGUMENTS
```

**If $ARGUMENTS is a description** — create the issue first:
```bash
gh issue create --title "$ARGUMENTS" --label "bug"
```

Record the assigned issue number — this becomes the B-number.
B42 corresponds to GitHub issue #42. The spec file will be `specs/B042-[slug].md`.

Read `DESIGN.md` and `CLAUDE.md` for architecture context before investigating.

---

## Phase 1: Locate

Map the described behavior to a code path:
- Identify which screen, component, hook, or API call is involved in the reported behavior
- Use Grep to search for relevant function names, strings, or patterns mentioned in the description
- Read the likely entry-point files to trace the code path and confirm the location

**Phase 1 fails when:** the behavior is too vague to map to code, the code path is
cross-cutting across many unrelated modules, or no clear entry point can be found from
static analysis.

→ If Phase 1 fails: write a **Type 3 spec** (see Spec Formats) and stop. Report to the user.

---

## Phase 2: Diagnose

Read the located files in depth:
- Trace the specific failure path through the code
- Identify the root cause and what the fix looks like

**Phase 2 fails when:** the located code looks correct from static analysis and the root
cause must involve runtime state, interaction effects, platform-specific behavior, timing,
or user data that cannot be observed from reading the code.

→ If Phase 2 fails: write a **Type 2 spec** (see Spec Formats) and stop. Report to the user.
  Phase 1 gave us a location, so the spec tells the implementor *where* to focus — they are
  not starting from scratch.

---

## Phase 3: Assess Blast Radius

*Only reached when Phase 2 successfully identifies the root cause and fix.*

**Step 1 — Interface check:** Does the fix change any exported interface?
(function signature, hook return shape, exported type, component prop)
- No → fix is contained; lean toward Claude applying directly
- Yes → proceed to Step 2

**Step 2 — Grep for callers:** Search for all consumers of the changed interface.
- No callers found, or all callers were already read in Phases 1–2 → contained
- Few callers in small unread files → read them now; if fix remains clear, proceed toward direct fix
- Many callers, or callers in large/complex unread files → hand off; write a **Type 1 spec**

**Step 3 — Test requirement:** Does the fix require a new test *file*?
(Modifying an existing test does not count — only net-new test files trigger handoff.)
- Yes → hand off; write a **Type 1 spec**
- No → proceed toward direct fix

**Direct fix path:**
Apply the fix using Edit/Write tools. Modify any affected existing tests in the same pass.
Run `./check-tests --show-known` to verify. Report the result and ask whether to commit.

---

## Spec Formats

All specs go in `specs/` named `B[zero-padded-issue-number]-[short-description].md`
(e.g. `specs/B042-avatar-menu-dismiss.md`).

Bug specs omit sections not relevant to bugs (Undo/Redo, Household Scoping, Realtime
Tracking, React Query Keys) unless the fix specifically involves them.

---

### Type 1 — Fix known, handoff needed
*Used when: Phase 3 found callers in large unread files, or a new test file is needed.*

```markdown
# Bug Fix: #[N] [Issue title]
<!-- GitHub: #[N] | Status: Specced -->

## Root Cause
[What is actually broken and why — specific, not a restatement of the symptom]

## Files to Modify
[Same format as feature specs — file path, numbered changes, Ensure block for invariants]

## New Files
[Test files only, if a new test file is needed to cover this bug]

## Fix Description
[Exactly what to change and why — sufficient detail that the implementor does not need
to re-derive the diagnosis]

## Tests to Write
[Only if a new test file is needed: specific test cases and assertions]

## What the Implementor Should NOT Change
[Guard against scope creep — list files and behaviors that are off-limits]

## Implementation Commands
./implement B[N]
```

---

### Type 2 — Area known, root cause requires runtime investigation
*Used when: Phase 1 succeeded (location found) but Phase 2 failed (static analysis inconclusive).*

```markdown
# Bug Fix: #[N] [Issue title]
<!-- GitHub: #[N] | Status: Specced -->

## Suspected Area
[Which files/components are believed to be involved, and why they are the likely location]

## What Static Analysis Ruled Out
[What Claude examined and confirmed is NOT the cause — saves the implementor from
re-checking the same dead ends]

## Investigation Required
The root cause cannot be determined from static analysis alone.

1. Reproduce the bug: [reproduction steps from the issue]
2. Focus investigation on: [specific area identified in Phase 1]
3. Record findings in `plans/B[N]-progress.md` under an "Investigation" heading
   before writing any fix code
4. Once root cause is confirmed, implement the fix in the same session

## What the Implementor Should NOT Change
[Guard against scope creep]

## Implementation Commands
./implement B[N]
```

---

### Type 3 — Location unknown, full investigation needed
*Used when: Phase 1 failed (no code path identifiable from static analysis).*

```markdown
# Bug Fix: #[N] [Issue title]
<!-- GitHub: #[N] | Status: Specced -->

## Behavior Description
[Exact description of what is broken, from the issue]

## Reproduction Steps
[Steps to reproduce, if known from the issue]

## Investigation Required
The code path responsible for this behavior could not be identified from static analysis.

1. Reproduce the bug following the steps above
2. Identify which component/hook/API call is involved
3. Trace to root cause
4. Record findings in `plans/B[N]-progress.md` under an "Investigation" heading
   before writing any fix code
5. Implement the fix in the same session

## What the Implementor Should NOT Change
[Guard against scope creep — list any known boundaries even without a located root cause]

## Implementation Commands
./implement B[N]
```

---

## Escalate — Do Not Write a Spec

Stop and report to the user (do not write a spec) when:

- The fix requires architectural decisions or changes to protected patterns
  (`api/undoContext.tsx`, `api/list.ts` mutation patterns, root provider tree in `app/_layout.tsx`)
- The bug reveals a missing feature rather than broken behavior
- The reproduction steps in the issue are too vague to act on — ask the user to clarify first
- Phase 3 shows the blast radius is large enough to warrant a design conversation

In these cases, describe the findings and reasoning clearly so the user can decide next steps.
