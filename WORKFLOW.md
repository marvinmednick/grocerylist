# Development Workflow

This document describes the end-to-end development process for this project, including the roles of Claude and Gemini, the tracking system, and how to handle every common scenario.

## Philosophy

This project uses two AI assistants with distinct roles:

- **Claude** — architecture, design, planning, and code review. Claude understands intent, makes decisions about structure, and specifies exactly what Gemini should build and test.
- **Gemini** — implementation and testing. Gemini writes code and tests to spec and reports back when all tests pass.

The clean separation matters: Gemini is a capable coder but works best with precise instructions. Claude provides those instructions in the form of specs. This prevents architectural drift, keeps patterns consistent, and ensures nothing falls through the cracks.

---

## Tracking System

Four files and one external service work together:

| Location | Purpose | Updated by |
|----------|---------|------------|
| `PLAN.md` | Feature registry — every feature has a row with ID, status, spec link, and GitHub issue link | Claude (during `/spec`, `/review`, and ship) |
| `specs/F[NNN]-[slug].md` | Full implementation spec — everything Gemini needs to build a feature | Claude (via `/spec`) |
| `BACKLOG.md` | Small deferred tasks and non-blocking findings — items too small for a spec | Claude (during `/spec` and `/review`) |
| `GEMINI.md` | Coding conventions and patterns — Gemini's reference for every implementation | Claude (when new patterns are established) |
| GitHub Issues | Formal record linked to commits — audit trail and commit cross-referencing | Claude (via `gh` CLI, automated in commands) |

### Feature IDs vs GitHub Issue Numbers

These are two independent numbering sequences that are linked but not the same.

**Feature IDs** (F001, F002, …) are assigned by us:
- Sequential, feature-only — every spec gets the next number regardless of what else is in GitHub
- Stable — an F-number never changes once assigned
- Used in: spec filenames, PLAN.md rows, spec headers, BACKLOG.md references

**GitHub Issue Numbers** (#1, #2, …) are assigned by GitHub:
- Sequential across *all* issue types — features, bugs, questions, anything filed in the repo
- Used in: commit messages (`closes #1`), PR descriptions, GitHub's audit trail

F001 happened to become issue #1 because it was the first issue in a fresh repo. But F002 might become issue #5 if three bugs were filed in between. The PLAN.md table and the spec header always record both, so you can find the relationship:

```
| F001 | List Interaction Modes | Specced | specs/F001-list-interactions.md | #1 |
```

**Commit messages use the GitHub issue number** so that GitHub auto-closes the issue on merge:
```
git commit -m "feat: implement interaction modes (closes #1)"
```

---

## Feature Lifecycle

```
Idea → [Design] → Specced → In Progress → In Review → Done
```

| Status | Meaning | Files updated |
|--------|---------|---------------|
| Backlog | Planned but not yet specced | PLAN.md row added |
| Specced | Spec written, GitHub issue open, ready for Gemini | spec file created, PLAN.md updated, issue created |
| In Progress | Gemini is implementing | (Gemini working) |
| In Review | Gemini submitted, Claude reviewing | PLAN.md updated, issue comment added |
| Done | Review passed, merged | PLAN.md updated to Done, GitHub issue closed |

---

## Use Cases

### 1. New Feature That Already Has a Design Doc

When the feature is in `PLAN.md` as Backlog and has a corresponding design doc in `docs/design/`:

**In Claude:**
```
/spec Multi-User Trip Management
```

Claude will:
1. Read `docs/design/multi-user-trips.md` and `DESIGN.md`
2. Assign the next F-number (e.g. F002)
3. Write `specs/F002-multi-user-trips.md`
4. Create GitHub issue `gh issue create --title "F002: Multi-User Trip Management" ...`
5. Update `PLAN.md` row from `Backlog` to `Specced`
6. Append any deferred items to `BACKLOG.md`

**Hand to Gemini** using `specs/F002-multi-user-trips.md` + `GEMINI.md` (see [Handing Off to Gemini](#handing-off-to-gemini)).

---

### 2. New Feature That Needs Design First

When you have an idea but no design doc yet, have a design conversation with Claude before running `/spec`.

**In Claude:**
```
I want to add price tracking — log what items cost at each store so we
can estimate trip totals. How should this work?
```

Claude will discuss the design, ask clarifying questions, and produce a design. Once you're happy with the direction:
```
That looks good. Can you write that up as a design doc in docs/design/
and then run /spec for it?
```

Claude writes `docs/design/price-tracking.md` first, then produces the spec.

---

### 3. Handing Off to Gemini

**If using Gemini CLI:**
```bash
gemini "Read GEMINI.md and specs/F001-list-interactions.md, then implement
the spec. Run npm test from client/ before reporting back."
```

**If using copy-paste (AI Studio or similar):**
Paste in this order:
1. Full contents of `GEMINI.md`
2. Full contents of `specs/F[NNN]-[slug].md`
3. Contents of the specific files the spec says to modify (prevents hallucination on existing code)

End with:
> "Implement the spec following the conventions in GEMINI.md. Run all tests and confirm they pass. List every file you changed and include the full diff or final file contents."

**What Gemini should return:**
- Every changed file (diff or full contents)
- Test output confirming all tests pass
- Any spec sections that couldn't be implemented as written, with explanation

---

### 4. Reviewing Gemini's Implementation

Bring Gemini's output back to Claude and run:

```
/review F001
```

Or paste the diff/changed files directly:
```
/review [paste Gemini's output here]
```

Claude will:
1. Check all mandatory patterns (household guard, undo registration, realtime tracking, etc.)
2. Check test coverage against the spec's Tests to Write section
3. Post a review comment on the GitHub issue
4. Append non-blocking findings to `BACKLOG.md`
5. Update PLAN.md status to `In Review` (if passing) or keep `In Progress` (if blocking issues)

**If blocking issues exist:** Share Claude's review with Gemini for fixes, then re-review.

**If review passes:** Proceed to ship (see below).

---

### 5. Shipping a Feature

Once review passes:

1. Commit the implementation with the GitHub issue number:
   ```bash
   git commit -m "feat: implement list interaction modes and header consolidation (closes #1)"
   ```

2. Close the issue and update PLAN.md:
   ```bash
   gh issue close 1 --comment "Implemented and reviewed."
   ```
   Then update the PLAN.md row status from `In Review` to `Done`.

3. Push:
   ```bash
   git push
   ```

---

### 6. Bug Fix

Bugs don't get F-numbers or spec files — they're too small and usually don't require architectural decisions.

1. File a GitHub issue directly:
   ```bash
   gh issue create --title "Avatar menu doesn't close on web" --label "bug"
   ```

2. If the fix is simple, describe it to Gemini directly with `GEMINI.md` as context (no spec needed).

3. Commit referencing the issue:
   ```bash
   git commit -m "fix: close avatar menu on backdrop press on web (closes #4)"
   ```

4. If investigating the bug reveals a design decision is needed, escalate to Claude before handing to Gemini.

---

### 7. Small Cleanup or Deferred Task

Items in `BACKLOG.md` are tasks too small for a spec. Handle them by:

1. Pick an item from `BACKLOG.md`
2. Describe it to Gemini with `GEMINI.md` as context
3. Commit with a reference to what it came from:
   ```bash
   git commit -m "chore: remove dead modal.tsx (deferred from F001)"
   ```
4. Check the item off in `BACKLOG.md`

If a backlog item turns out to be larger than expected, promote it:
```
This modal.tsx cleanup actually needs a full Settings screen.
Can you spec that out as a new feature?
```
Then run `/spec Settings Screen` and it becomes F007 (or whatever is next).

---

### 8. Adding an Item to the Backlog Directly

When you notice something that should be fixed but doesn't need immediate attention, add it to `BACKLOG.md` manually:

```markdown
## Tech Debt
- [ ] Migrate items screen to use same consolidated header pattern as F001
```

No GitHub issue needed for backlog items — they're lightweight by design.

---

### 9. Updating GEMINI.md

When a new coding pattern is established that Gemini needs to follow on future features, update `GEMINI.md` to document it. This typically happens when:
- A new mandatory pattern is introduced (e.g. a new provider that must be wrapped)
- A new React Query key convention is added
- A pattern is deprecated or changed

Tell Claude:
```
We've established that all new screens need to wrap with FooProvider.
Can you add that to GEMINI.md?
```

Claude will add it to the Mandatory Coding Patterns section so all future specs and Gemini sessions pick it up.

---

## Quick Reference

| Task | Do this |
|------|---------|
| Spec a new feature | `/spec [feature name]` in Claude |
| Hand off to Gemini | Paste `GEMINI.md` + spec file into Gemini |
| Review Gemini's code | `/review [feature ID or paste diff]` in Claude |
| Ship a feature | Commit with `closes #N`, run `gh issue close N`, update PLAN.md |
| File a bug | `gh issue create --label "bug"` |
| Handle a backlog item | Describe to Gemini directly, commit, check off in BACKLOG.md |
| Promote backlog to feature | `/spec [description]` in Claude |
| Update coding conventions | Ask Claude to update `GEMINI.md` |
| See all features and status | Open `PLAN.md` |
| See small deferred items | Open `BACKLOG.md` |
| See GitHub issues | `gh issue list` or https://github.com/marvinmednick/grocerylist/issues |

---

## File Reference

| File | Read when |
|------|-----------|
| `WORKFLOW.md` | Learning or explaining the process (this file) |
| `CLAUDE.md` | Starting a Claude session — project guidance and architecture |
| `GEMINI.md` | Starting a Gemini session — coding conventions and patterns |
| `PLAN.md` | Checking feature status or finding the right spec |
| `BACKLOG.md` | Looking for small tasks to clean up |
| `specs/F[NNN]-*.md` | Implementing or reviewing a specific feature |
| `DESIGN.md` | Understanding full system architecture before designing a feature |
| `docs/design/[feature].md` | Deep dive on a specific feature's design |
