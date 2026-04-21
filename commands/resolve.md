Resolve a non-feature GitHub issue. Input ($ARGUMENTS) is either a GitHub issue number (e.g. `42`) or a plain-text description of the problem (a new issue will be created first).

Issues use their GitHub issue number as the identifier. If a spec file is needed, it is named `specs/I[N]-[slug].md` (e.g. `specs/I42-avatar-menu-dismiss.md`).

**Naming convention:** Do NOT zero-pad issue numbers. Use `I38`, not `I038`. Use `I42`, not `I042`. The number is always bare.

## Setup

**If $ARGUMENTS is a number** — fetch the existing issue:
```bash
gh issue view $ARGUMENTS --json number,title,body,labels 2>/dev/null
```

**If $ARGUMENTS is a description** — create the issue first:
```bash
gh issue create --title "$ARGUMENTS" --label "bug"
```

Record the assigned issue number — this is the I-number used for any spec or progress files.

Read the issue labels to determine the path:
- `bug` → run the full three-phase investigation below
- `cleanup`, `test-quality`, `docs`, `enhancement` → skip investigation; read the issue and apply the fix directly
- `feature` → stop and tell the user: this should go through `/spec` first to get an F-number and full implementation spec

Read `DESIGN.md` and `CLAUDE.md` for architecture context before investigating or fixing.

---

## Path A — Bug Investigation (label: `bug`)

### Stage Detection

Before running investigation phases, check what's already been done on this issue:

```bash
# Check for a spec file (investigation complete, fix ready to implement)
ls specs/I${N}-*.md 2>/dev/null

# Check issue body for existing triage/investigation
gh issue view $N --json body | jq -r '.body'
```

Act based on what's found:

| State | Signal | Action |
|-------|--------|--------|
| Spec file exists | `specs/I[N]-*.md` present | Skip to "When a spec is written" — run `./implement I[N]` |
| Fully investigated | `## Investigation Findings` section present + effort `(confirmed)` | Skip Phases 1+2; go to Phase 3 with findings already known |
| Root cause in triage | Triage has `(confirmed)` effort and Root Cause described | Skip Phases 1+2; go to Phase 3 |
| Partially triaged | Triage present but effort `(unknown)` or `(estimated)` | Skip triage re-assessment; run Phases 1+2+3 |
| Nothing done | No triage section | Run all phases; assess triage en route |

When skipping to Phase 3 with known findings, read the `## Investigation Findings` or `## Triage` root cause description before assessing blast radius — treat it as the output of Phase 2.

---

### Phase 1: Locate

Map the described behavior to a code path:
- Identify which screen, component, hook, or API call is involved in the reported behavior
- Use Grep to search for relevant function names, strings, or patterns mentioned in the description
- Read the likely entry-point files to trace the code path and confirm the location

**Phase 1 fails when:** the behavior is too vague to map to code, the code path is
cross-cutting across many unrelated modules, or no clear entry point can be found from
static analysis.

→ If Phase 1 fails: write a **Type 3 spec** (see Spec Formats) and stop. Report to the user.

---

### Phase 2: Diagnose

Read the located files in depth:
- Trace the specific failure path through the code
- Identify the root cause and what the fix looks like

**Phase 2 fails when:** the located code looks correct from static analysis and the root
cause must involve runtime state, interaction effects, platform-specific behavior, timing,
or user data that cannot be observed from reading the code.

→ If Phase 2 fails: write a **Type 2 spec** (see Spec Formats) and stop. Report to the user.

---

### Phase 3: Assess Blast Radius

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

Before committing, ensure the issue has a complete `## Triage` section with `(confirmed)` effort.
If triage is missing or effort was previously `(unknown)`/`(estimated)`, update it now:
```bash
gh issue edit N --body "..." # prepend/update ## Triage section
gh issue edit N --add-label "severity:[high|medium|low]" --add-label "effort:[small|medium|large]"
```

---

## Path B — Direct Fix (labels: `cleanup`, `test-quality`, `docs`, `enhancement`)

Read the issue body carefully, then apply the fix directly:
- No investigation phases needed
- Make the change, run `./check-tests --show-known` to verify nothing broke
- Report the result and ask whether to commit via `/complete [N]`

If the fix turns out to be larger or more complex than the issue described, stop and report rather than expanding scope unilaterally.

---

## Spec Formats

All specs go in `specs/` named `I[zero-padded-3-digit-issue-number]-[short-description].md`
(e.g. `specs/I042-avatar-menu-dismiss.md`).

Issue specs omit sections not relevant to the issue type (Undo/Redo, Household Scoping,
Realtime Tracking, React Query Keys) unless the fix specifically involves them.

---

### Type 1 — Fix known, handoff needed
*Used when: Phase 3 found callers in large unread files, or a new test file is needed.*

```markdown
# Issue Fix: #[N] [Issue title]
<!-- GitHub: #[N] | Status: Specced -->

## Root Cause
[What is actually broken and why — specific, not a restatement of the symptom]

## Files to Modify
[Same format as feature specs — file path, numbered changes, Ensure block for invariants]

## New Files
[Test files only, if a new test file is needed to cover this issue]

## Fix Description
[Exactly what to change and why — sufficient detail that the implementor does not need
to re-derive the diagnosis]

## Tests to Write
[Only if a new test file is needed: specific test cases and assertions]

## What the Implementor Should NOT Change
[Guard against scope creep — list files and behaviors that are off-limits]

## Implementation Commands
./implement I[N]
```

---

### Type 2 — Area known, root cause requires runtime investigation
*Used when: Phase 1 succeeded (location found) but Phase 2 failed (static analysis inconclusive).*

```markdown
# Issue Fix: #[N] [Issue title]
<!-- GitHub: #[N] | Status: Specced -->

## Suspected Area
[Which files/components are believed to be involved, and why they are the likely location]

## What Static Analysis Ruled Out
[What Claude examined and confirmed is NOT the cause — saves the implementor from
re-checking the same dead ends]

## Investigation Required
The root cause cannot be determined from static analysis alone.

1. Reproduce the issue: [reproduction steps from the issue]
2. Focus investigation on: [specific area identified in Phase 1]
3. Record findings in `plans/I[N]-progress.md` under an "Investigation" heading
   before writing any fix code
4. Once root cause is confirmed, implement the fix in the same session

## What the Implementor Should NOT Change
[Guard against scope creep]

## Implementation Commands
./implement I[N]
```

---

### Type 3 — Location unknown, full investigation needed
*Used when: Phase 1 failed (no code path identifiable from static analysis).*

```markdown
# Issue Fix: #[N] [Issue title]
<!-- GitHub: #[N] | Status: Specced -->

## Behavior Description
[Exact description of what is broken, from the issue]

## Reproduction Steps
[Steps to reproduce, if known from the issue]

## Investigation Required
The code path responsible for this behavior could not be identified from static analysis.

1. Reproduce the issue following the steps above
2. Identify which component/hook/API call is involved
3. Trace to root cause
4. Record findings in `plans/I[N]-progress.md` under an "Investigation" heading
   before writing any fix code
5. Implement the fix in the same session

## What the Implementor Should NOT Change
[Guard against scope creep — list any known boundaries even without a located root cause]

## Implementation Commands
./implement I[N]
```

---

## Create Log Entry

After the fix is verified (before committing), create `plans/[prefix][N]-log.md` — using the same identifier prefix as used in PLAN.md (e.g. `plans/I107-log.md` or `plans/F107-log.md`):

```markdown
# [Issue title]

GitHub: [#N](URL)
Workflow: resolve (no spec, no progress file)

---

## YYYY-MM-DD — Resolved

- **Fix:** [one sentence: what was changed and why]
- **Path:** [Path A — bug investigation / Path B — direct fix]
- **Files changed:** [list]
- **Tests:** [X/X passed]
```

This log is the signal used by `/review-impl` to detect resolve-path issues and adjust review scope accordingly.

---

## Design Review

After identifying and applying a fix (Phase 3 direct fix path or Type 1 spec), check whether the root cause reveals a broader principle:

- Does this bug reflect a pattern that could recur elsewhere?
- Does the fix change how a component or pattern should be used going forward?
- Did Phase 3 find callers that use the same flawed approach?

If yes: run `/design-review resolve` before committing. If the fix was a contained, specific bug with no broader implications, skip.

---

## Escalate — Do Not Write a Spec

Stop and report to the user (do not write a spec) when:

- The fix requires architectural decisions or changes to protected patterns
  (`api/undoContext.tsx`, `api/list.ts` mutation patterns, root provider tree in `app/_layout.tsx`)
- The issue reveals a missing feature rather than broken behavior — suggest `/spec` instead
- The reproduction steps in the issue are too vague to act on — ask the user to clarify first
- Phase 3 shows the blast radius is large enough to warrant a design conversation

In these cases, describe the findings and reasoning clearly so the user can decide next steps.
