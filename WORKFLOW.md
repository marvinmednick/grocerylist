# Development Workflow

> **Details below.** This cheatsheet is the "what do I run" view — scan it for the right command, then read the relevant section for the full story.

---

## Cheatsheet

### Feature Flow

```
Idea → [/design] → /spec → ./implement → /review → /complete
```

`/design` is optional for simple features with clear requirements. Use it when UX, data model, or scope needs discussion before a spec can be written.

| Step | Command | When |
|------|---------|------|
| Design | `/design Feature Name` in Claude | When requirements need discussion or a design doc needs updating |
| Spec | `/spec Feature Name` or `/spec F2` | Always — reads design doc if one exists |
| Implement (Light) | `./implement F1` | Review level Light |
| Implement (Full) | `./implement F1 --plan` → `/review-plan F1` → `./implement F1` | Review level Full |
| Review code | `/review F1` after implementor reports tests passing | Always |
| Ship | `/complete F1` | After review passes |

### Bug Flow

```
File → Triage → Investigate → /resolve → /complete
```

| Step | Command | When |
|------|---------|------|
| File | `/resolve <description>` or `gh issue create` | Always; capture triage inline if cause is already known |
| Triage | `/triage N` or `/triage N1 N2 …` | Assess severity + effort; no code tracing |
| Investigate | `/investigate N` | When effort is unknown and you need root cause before deciding |
| Fix | `/resolve N` | Stage-aware — skips what's already done |
| Ship | `/complete N` | Same as feature shipping |

### Other Commands

| Command | When |
|---------|------|
| `/fix-baseline` | Unexpected test failures exist before starting a feature |
| `./check-tests` | Verify clean baseline before committing |
| `/triage` (no args) | Triage all open bugs in one pass |
| `./implement F1 --tool aider --model claude-sonnet-4-6` | Override tool or model |
| `gh issue list --label bug --state open` | See all open bugs |

### Implement Tool Selection

Tool is read from `.implement.conf` → `IMPLEMENT_TOOL` env → `--tool` arg (arg wins).

| Flag | Tool |
|------|------|
| `--tool codex` | Codex CLI (project default) |
| `--tool gemini` | Gemini CLI |
| `--tool aider --model <model>` | aider (interactive) |

---

## Philosophy

This project uses two distinct roles:

- **Claude** — architecture, design, planning, and code review. Claude understands intent, makes decisions about structure, and specifies exactly what the implementor should build and test.
- **Implementor** (Gemini, aider, or similar tool) — implementation and testing. The implementor writes code and tests to spec and reports back when all tests pass.

The clean separation matters: implementation tools work best with precise instructions. Claude provides those instructions in the form of specs. This prevents architectural drift, keeps patterns consistent, and ensures nothing falls through the cracks.

---

## Tracking System

Four files and one external service work together:

| Location | Purpose | Updated by |
|----------|---------|------------|
| `PLAN.md` | Feature registry — every feature has a row with ID, status, spec link, and GitHub issue link | Claude (during `/spec`, `/review`, and ship) |
| `specs/F[N]-[slug].md` | Full implementation spec — everything Gemini needs to build a feature | Claude (via `/spec`) |
| `BACKLOG.md` | Short-lived inbox — items land here during `/spec` and `/review`, then are triaged to GitHub Issues (or discarded) right after each commit | Claude (during `/spec`, `/review`, and post-commit triage) |
| `CODING.md` | Coding conventions and patterns — the implementor's reference for every implementation | Claude (when new patterns are established) |
| `docs/tools/gemini.md` | Gemini invocation reference (human docs) | Claude (when Gemini workflow changes) |
| `AGENT.md` | Behavioral rules for all implementation agents | Claude (when scope discipline changes) |
| GitHub Issues | Formal record linked to commits — audit trail and commit cross-referencing | Claude (via `gh` CLI, automated in commands) |

### Feature IDs vs GitHub Issue Numbers

These are two independent numbering sequences that are linked but not the same.

**Feature IDs** (F1, F2, …) are assigned by us:
- Sequential, feature-only — every spec gets the next number regardless of what else is in GitHub
- Stable — an F-number never changes once assigned
- Used in: spec filenames, PLAN.md rows, spec headers, BACKLOG.md references

**GitHub Issue Numbers** (#1, #2, …) are assigned by GitHub:
- Sequential across *all* issue types — features, bugs, questions, anything filed in the repo
- Used in: commit messages (`closes #1`), PR descriptions, GitHub's audit trail

F1 happened to become issue #1 because it was the first issue in a fresh repo. But F2 might become issue #5 if three bugs were filed in between. The PLAN.md table and the spec header always record both, so you can find the relationship:

```
| F1 | List Interaction Modes | Specced | specs/F1-list-interactions.md | #1 |
```

**Commit messages use the GitHub issue number** so that GitHub auto-closes the issue on merge:
```
git commit -m "feat: implement interaction modes (closes #1)"
```

---

## Feature Lifecycle

```
Idea → Backlog → [Designed] → Specced → In Progress → In Review → Done
```

`Designed` is optional — features with clear requirements can go directly from `Backlog` to `Specced`.

| Status | Meaning | Files updated |
|--------|---------|---------------|
| Backlog | Planned but not yet designed or specced | PLAN.md row added |
| Designed | Design doc written, decisions recorded; ready to spec | `docs/design/F[N]-[slug].md` created, PLAN.md updated |
| Specced | Spec written, GitHub issue open, ready for implementor | spec file created, PLAN.md updated, issue created |
| In Progress | Implementor is implementing | (implementor working) |
| In Review | Implementor submitted, Claude reviewing | PLAN.md updated, issue comment added |
| Done | Review passed, merged | PLAN.md updated to Done, GitHub issue closed |

---

## Use Cases

### 1. Feature With a Design Doc

When the feature has a design doc (status `Designed` in PLAN.md), run `/spec` directly:

**In Claude:**
```
/spec Multi-User Trip Management
```

Claude will:
1. Read `docs/design/F2-multi-user-trips.md` and `DESIGN.md`
2. Do a consistency check — verify the design doc's references to existing code are still accurate
3. Flag any drift to you and ask how to proceed before continuing
4. Write `specs/F2-multi-user-trips.md`
5. Create GitHub issue `gh issue create --title "F2: Multi-User Trip Management" ...`
6. Update `PLAN.md` row from `Designed` to `Specced`
7. Append any deferred items to `BACKLOG.md`

**Hand to implementor** using `specs/F2-multi-user-trips.md` + `AGENT.md` + `CODING.md` (see [Handing Off to the Implementor](#handing-off-to-the-implementor)).

---

### 2. Feature That Needs Design First

When you have an idea but no design doc yet, start with `/design`:

**In Claude:**
```
/design Price Tracking
```

Claude will:
1. Ask clarifying questions about UX, data model, scope, and integration points
2. Discuss options and trade-offs for each significant decision
3. Record all decisions in `docs/design/F[N]-price-tracking.md`
4. Update `PLAN.md` status to `Designed`

Once the design is complete:
```
/spec F[N]
```

Claude reads the design doc and writes the spec with all decisions already resolved.

**When to use `/design` vs going straight to `/spec`:**
- Use `/design` when: UX is unclear, multiple data model approaches exist, scope needs discussion, or the feature interacts with several existing systems
- Go straight to `/spec` when: requirements are obvious, DESIGN.md already covers the approach, and the feature is a well-understood addition to existing patterns

**Updating an existing design doc:**

If a feature already has a design doc but you want to refine it (or the codebase has drifted):
```
/design F2
```

Claude enters update mode: reads the existing doc, scans for drift, presents required and desired changes, and updates the doc interactively.

---

### 3. Handing Off to the Implementor

#### Review Levels

Each spec has a `**Review Level:**` header — **Light** or **Full**. The spec author sets this; you don't need to judge it yourself.

| | Light | Full |
|---|---|---|
| **When** | 1–2 files, no new files, no schema changes, existing patterns only | 3+ files, new files, schema changes, or new patterns |
| **Flow** | Implement → `/review` → tests → commit | Plan → Claude plan review → implement → `/review` → tests → commit |

**Light workflow:**
```
./implement F1                    # implementor writes code, runs tests, fixes failures
  ↓
Claude /review                      # review code and test quality
  ↓
./check-tests                       # pre-commit baseline verify
  ↓
Commit
```

**Full workflow:**
```
./implement F1 --plan             # implementor writes plans/F1-plan.md, then exits
  ↓
/review-plan F1                   # Claude reviews, fixes gaps, iterates with you, writes
                                    # plans/F1-plan-approved.md when both parties approve
  ↓
./implement F1                    # implementor runs full session: code + tests + fixes
  ↓
Claude /review                      # review code and test quality
  ↓
./check-tests                       # pre-commit baseline verify
  ↓
Commit
```

Running and fixing tests is part of the implementation session — the implementor does not
hand off until all tests pass. `/review` checks code quality and test coverage; `./check-tests`
is a final sanity check that the baseline is clean before committing.

#### Reviewing the Plan (Full Level)

After `./implement F[N] --plan` writes `plans/F[N]-plan.md`, run in Claude Code:

```
/review-plan F1
```

Claude will:
1. Read the plan and spec
2. **Leave `plans/F[N]-plan.md` unmodified** — the original draft is preserved for comparison
3. Report gaps found and flag anything needing your input
4. Iterate with you until both parties are satisfied
5. Write the corrected plan to **`plans/F[N]-plan-approved.md`** — this is what the implementor uses

The original draft and the approved file can be diffed at any time to see exactly what the review process changed.

**This is scope/approach only — not a code review.** Claude checks the plan matches the spec and fixes it; the full pattern and test check happens later with `/review`.

**`./implement F1` auto-detects the approved plan.** Once `/review-plan F1` writes
`plans/F1-plan-approved.md`, the next `./implement F1` picks it up automatically.
Running `./implement F1` on a Full-level spec without an approved plan will error with guidance.

---

#### Automated (recommended)

Use the `implement` script from the project root — it finds the spec, extracts the file list, and runs the right command:

```bash
./implement F1                        # implement (uses tool from .implement.conf)
./implement F1 --plan                 # write plan only (Full level, step 1)
./implement F1 --tool codex           # use Codex (explicit override)
./implement F1 --tool gemini          # use Gemini CLI
./implement F1 --tool aider           # use aider (interactive)
./implement F1 --tool aider --model claude-sonnet-4-6
./implement I42                       # issue spec (I-number = GitHub issue number)
```

#### Tool Selection

The active tool is configured in `.implement.conf` (committed default) and can be overridden via `IMPLEMENT_TOOL` env var or `--tool` arg. See `.implement.conf` for the current project default.

| Tool | Best when |
|------|-----------|
| **Codex CLI** | Autonomous run-to-completion; strong OpenAI model support; default tool |
| **Gemini CLI** | Autonomous run-to-completion; large context window; Google model support |
| **aider** | Interactive session; initial prompt sent via `--message`, type `continue` to proceed through remaining files |
| **Copy-paste** | Web interfaces (AI Studio, ChatGPT) where no CLI is available |

**aider edit format:** `diff` is set as the project default in `.aider.conf.yml`. This is required for Azure-hosted or other unrecognized models — without it, aider falls back to `whole` format, which causes some models to return narrative summaries instead of writing actual file edits. See `docs/tools/aider.md` for details.

#### Manual Codex CLI

`AGENTS.md` is auto-loaded. The prompt also explicitly requires both context files — see `docs/tools/codex.md` for details.

```bash
codex exec -a never -s workspace-write \
  "First read AGENT.md and CODING.md in full. Confirm you have read both. Implement specs/F1-list-interactions.md. Run npm test from client/ when done. List all files changed and paste the test output."
```

#### Manual Gemini CLI

`AGENT.md` and `CODING.md` are auto-loaded via `.gemini/settings.json`. Just point at the spec:

```bash
gemini "Implement specs/F1-list-interactions.md. Run npm test from client/ when done. List all files changed and paste the test output."
```

#### Manual aider

`AGENT.md` and `CODING.md` are auto-loaded via `.aider.conf.yml`. Pass the spec as `--read` and list the files to edit:

```bash
aider --model <model-flag> \
  --read specs/F1-list-interactions.md \
  client/app/(tabs)/index.tsx \
  client/lib/household.tsx
```

See `docs/tools/aider.md` for full setup and model selection.

#### Copy-paste (web UI only — not needed for CLI tools)

Paste in this order:
1. Full contents of `AGENT.md`
2. Full contents of `CODING.md`
3. Full contents of `specs/F[N]-[slug].md`
4. Contents of the specific files the spec says to modify

End with:
> "Implement the spec following the conventions in AGENT.md and CODING.md. Run all tests and confirm they pass. List every file you changed."

**What the implementor should return:**
- Every changed file (diff or full contents)
- Test output confirming all tests pass
- Any spec sections that couldn't be implemented as written, with explanation

#### Mid-Implementation Handoff

If implementation stops mid-spec (context limit, model switch, or session break):

1. The implementor updates `plans/F[N]-progress.md` with current state and displays it
2. To resume, run the same `./implement` command — the new session reads `plans/F[N]-progress.md` and self-orients; no user guidance needed
3. The `/review` step happens only after the full spec is complete

You can optionally make a WIP commit to save partial work, but this doesn't affect how the implementor resumes.

---

### 4. Running Tests and Managing the Baseline

#### The Baseline System

The project keeps a record of acknowledged pre-existing test failures in `client/known-test-failures.txt`. This separates signal from noise: new failures caused by a feature implementation stand out from pre-existing issues.

**`./check-tests`** runs the full test suite and categorizes results:
- **Unexpected failures** — not in the known list → exits 1, blocks the workflow
- **Known failures** — in the known list → noted but not blocking
- **Stale entries** — in the known list but not currently failing → prompts cleanup

```bash
./check-tests                 # run tests, fail on unexpected failures
./check-tests --show-known    # also show known failures that were observed
./check-tests --show-all      # show all failures regardless of baseline
```

The `implement` script automatically runs `./check-tests` before starting implementation, so you can see the baseline state before any code changes.

#### Fixing a Dirty Baseline

If `./check-tests` reports unexpected failures before you start a feature, address them first with `/fix-baseline`:

```
/fix-baseline
```

Claude will:
1. Run `./check-tests` and read the failures
2. Diagnose each failure as: **Fix**, **Add to known list**, or **Escalate**
3. **Present the full diagnosis to you and wait for your approval before doing anything**
4. After approval: apply fixes directly or via aider, update `known-test-failures.txt`, file escalations in `BACKLOG.md`
5. Re-run `./check-tests` to confirm the baseline is clean

This workflow can be used independently of any feature implementation — run it any time the baseline has accumulated failures that need addressing.

---

### 5. Reviewing the Implementation

> **This is post-code review** — it happens after the implementor reports back, not during the plan step. For plan review, see [Reviewing the Plan](#reviewing-the-plan-full-level) above.

Once the implementor reports back (all tests passing, files listed), run in Claude Code:

```
/review F1
```

Or with the diff/output pasted directly:
```
/review [paste implementor's output here]
```

Claude will:
1. Check all mandatory patterns (household guard, undo registration, realtime tracking, etc.)
2. Check test coverage against the spec's Tests to Write section
3. Post a review comment on the GitHub issue
4. Append non-blocking findings to `BACKLOG.md`
5. Update PLAN.md status to `In Review` (if passing) or keep `In Progress` (if blocking issues)

**If blocking issues exist:** Share Claude's review with the implementor for fixes, then re-review.

**If review passes:** Proceed to ship (see below).

---

### 6. Shipping a Feature

Once review passes, run in Claude Code:

```
/complete F1
```

Claude will:
1. Confirm `./check-tests` is clean
2. Show the diff, suggest a commit message, and commit (with `closes #N`)
3. Close the GitHub issue and update PLAN.md to `Done`
4. Triage BACKLOG.md — propose fix-now / promote / discard for each open item, then execute after your confirmation
5. Push

---

### 7. Non-Feature Issues (Bugs, Cleanup, Tasks)

Non-feature issues use their GitHub issue number directly. Issue #42 gets spec file
`specs/I42-avatar-menu-dismiss.md` if one is needed. No separate counter to manage.

#### Bug Lifecycle

Bugs move through distinct stages. Each can happen in the same session or separately:

```
Filed → Triaged → Investigated → Fixed → Shipped
```

| Stage | Command | What happens |
|-------|---------|-------------|
| **File** | `gh issue create` or `/resolve <description>` | Log the bug; capture what's already known |
| **Triage** | `/triage N` | Assess severity + effort; no code investigation |
| **Investigate** | `/investigate N` | Locate root cause (Phase 1+2); don't fix yet |
| **Fix** | `/resolve N` | Stage-aware: skips completed stages, applies fix |
| **Ship** | `/complete N` | Commit, close issue, triage backlog |

**Common paths:**

- Bug found during code review (cause already known): File → `/resolve N` (skips to fix)
- Bug from user report (cause unknown): File → `/triage N` → `/investigate N` → `/resolve N`
- Quick triage session: `/triage 18 19 20 21` across a batch of open bugs

---

#### Triage Fields

Every bug issue should have a `## Triage` section in its body:

```markdown
## Triage
- **Severity:** [High|Medium|Low] — [one-line impact rationale]
- **Effort:** [Small|Medium|Large] ([confirmed|estimated|unknown]) — [one-line rationale]
- **Root Cause:** [Brief description if known, or "not yet investigated"]
```

**Severity** (always knowable from description — no code needed):

| Severity | When |
|----------|------|
| High | Data integrity risk, security, app crash, no workaround |
| Medium | Incorrect visible behavior, functional workaround exists |
| Low | Cosmetic, edge case, rare sequence, minor UX |

**Effort qualifier:**

| Qualifier | Meaning |
|-----------|---------|
| `(confirmed)` | Root cause read or described; fix scope verified |
| `(estimated)` | Quick code look supports this estimate; not fully traced |
| `(unknown)` | Insufficient information; needs `/investigate` first |

**Capture what's already in context.** When a bug is found during a code review or spec session, files are already loaded — document the root cause and fix approach immediately. Do not re-investigate what's already understood. If cause is unknown, mark effort `(unknown)` and move on; investigation happens when you're ready to fix.

---

#### `/triage [N]` — Assess without fixing

```
/triage 18
/triage 18 19 20 21
/triage                   (all open bugs)
```

Assesses severity and estimates effort with minimal code examination. Updates the issue body and applies labels. Does **not** trace code paths, investigate root causes, or fix anything. Quick grep to locate a file is allowed; reading and tracing files is not — that's `/investigate`.

---

#### `/investigate N` — Understand root cause without fixing

```
/investigate 18
```

Runs Phase 1 (locate) and Phase 2 (diagnose). Identifies the root cause and documents findings on the issue — upgrading effort to `(confirmed)`. Does **not** run Phase 3 or apply any fix. Use when effort is `(unknown)` or `(estimated)` and you need to understand true scope before deciding whether to fix.

After investigation, choose: `/resolve N` to fix now, or defer based on findings.

---

#### `/resolve N` — Fix a bug (stage-aware)

```
/resolve Avatar menu doesn't close on web
/resolve 42
```

Reads the issue and skips stages that are already complete:

- Spec file exists → skip straight to `./implement I[N]`
- Investigation findings present + effort `(confirmed)` → skip to Phase 3 (blast radius) and fix
- Triage present but effort unknown → skip triage, run Phase 1+2+3
- Nothing done → run everything

For non-bug labels (`cleanup`, `test-quality`, `docs`, `enhancement`): reads the issue and applies the fix directly — no investigation phases.

**Bug investigation phases (when needed):**

- **Phase 1 — Locate:** Map behavior to code path via grep and file reads
- **Phase 2 — Diagnose:** Read located files; identify root cause and fix
- **Phase 3 — Blast radius:** Interface changes? Callers? New test files needed?

**Outcomes:**

| Outcome | What happens |
|---------|-------------|
| Fix contained, no new test file | Claude applies fix directly, runs `./check-tests`, asks to commit |
| Callers in large unread files, or new test file needed | Claude writes `specs/I[N]-slug.md` → `./implement I[N]` |
| Phase 2 fails (runtime/state-dependent) | Spec with suspected area + investigation instructions |
| Phase 1 fails (can't locate statically) | Spec with full investigate-and-fix instructions |
| Architectural implications | Escalates — design conversation before any spec |
| Labeled `feature` | Stops — should go through `/spec` first |

#### When a spec is written

```bash
./implement I42                   # implement the issue spec
./check-tests                     # verify after /review
```

#### Commit and close

```
/complete 42
```

Same steps as feature shipping: verify tests, commit with `closes #42`, close issue, triage BACKLOG.md, push.

---

### 8. Backlog Triage

`BACKLOG.md` is a short-lived inbox, not a permanent list. Items land there during `/spec` and `/review` because it's not the right moment to stop and handle them. The triage step (run after every feature ship or bug fix commit) clears the inbox.

For each open item, choose one action:

**Fix now** — if it's a 1–5 minute change with no risk, apply it in the same session and commit:
```bash
git commit -m "chore: remove dead modal.tsx (deferred from F1)"
```

**Promote to GitHub Issue** — for anything that needs more thought or is non-trivial, create an issue and remove it from BACKLOG.md. Use labels to signal the type:
```bash
gh issue create --title "Update useHousehold mock in index-interactions-test" --label "test-quality"
gh issue create --title "Haptic feedback on long press in shopping mode" --label "enhancement"
```

**Discard** — if the item is no longer relevant, just delete it from BACKLOG.md with a brief note in the commit message.

The goal is an empty (or near-empty) BACKLOG.md after every triage. If items accumulate across multiple sessions, that's a signal triage is being skipped.

#### Adding items to BACKLOG.md mid-session

When you notice something during `/spec` or `/review` that shouldn't interrupt the current task, add it to `BACKLOG.md` and come back to it at the next triage:

```markdown
- [ ] Migrate items screen to use same consolidated header pattern as F1 (noticed during F2 spec)
```

Items that grow in scope during triage can be promoted to a full feature:
```
This modal.tsx cleanup actually needs a full Settings screen — can you spec that?
```
Then run `/spec Settings Screen` and it becomes a new F-number.

---

### 10. Updating CODING.md

When a new coding pattern is established that implementors need to follow on future features, update `CODING.md` to document it. This typically happens when:
- A new mandatory pattern is introduced (e.g. a new provider that must be wrapped)
- A new React Query key convention is added
- A pattern is deprecated or changed

Tell Claude:
```
We've established that all new screens need to wrap with FooProvider.
Can you add that to CODING.md?
```

Claude will add it to the Mandatory Coding Patterns section so all future specs and implementation sessions pick it up.

---

## Quick Reference

| Task | Do this |
|------|---------|
| Design a feature (requirements + decisions) | `/design [feature name or F-number]` in Claude |
| Update an existing design doc | `/design F[N]` in Claude (enters update mode automatically) |
| Spec a new feature | `/spec [feature name or F-number]` in Claude |
| Hand off to implementor (Light) | `./implement F1` (or `--tool aider`, `--model <model>`) |
| Hand off to implementor (Full) | `./implement F1 --plan`, then `/review-plan F1`, then `./implement F1` |
| Review the plan (Full level) | `/review-plan F1` in Claude Code (preserves draft, writes approved file) |
| Review the implementation | `/review F1` in Claude Code (after implementor reports tests passing) |
| Verify tests before commit | `./check-tests` |
| Fix a dirty baseline | `/fix-baseline` in Claude Code (diagnose → propose → confirm → fix) |
| Ship a feature | `/complete F1` in Claude Code |
| File a bug | `/resolve <description>` or `gh issue create` |
| Triage bug(s) | `/triage N` or `/triage N1 N2 N3` or `/triage` (all open) |
| Investigate a bug (understand before fixing) | `/investigate N` in Claude Code |
| Fix a bug or non-feature issue | `/resolve N` in Claude Code (stage-aware) |
| Ship a non-feature issue | `/complete 42` in Claude Code |
| Triage backlog | Happens automatically as part of `/complete` |
| Promote backlog to feature | `/spec [description]` in Claude |
| Update coding conventions | Ask Claude to update `CODING.md` |
| See all features and status | Open `PLAN.md` |
| See small deferred items | Open `BACKLOG.md` |
| See GitHub issues | `gh issue list` or https://github.com/marvinmednick/grocerylist/issues |

---

## File Reference

| File | Read when |
|------|-----------|
| `WORKFLOW.md` | Learning or explaining the process (this file) |
| `CLAUDE.md` | Starting a Claude session — project guidance and architecture |
| `AGENT.md` | Starting any implementation session — behavioral rules for all tools |
| `CODING.md` | Starting any implementation session — coding conventions and patterns |
| `docs/tools/codex.md` | Codex invocation, API key, model selection (human reference) |
| `docs/tools/gemini.md` | Gemini invocation and copy-paste reference (human reference) |
| `docs/tools/aider.md` | aider setup, edit formats, model selection (human reference) |
| `PLAN.md` | Checking feature status or finding the right spec |
| `BACKLOG.md` | Looking for small tasks to clean up |
| `client/known-test-failures.txt` | Reviewing or updating acknowledged pre-existing test failures |
| `specs/F[N]-*.md` | Implementing or reviewing a specific feature |
| `DESIGN.md` | Understanding full system architecture before designing a feature |
| `docs/design/F[N]-[slug].md` | Design decisions for a feature — read before running `/spec`, update with `/design` |
