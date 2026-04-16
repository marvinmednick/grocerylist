Design or update the design for a feature. Input ($ARGUMENTS) is a feature name or feature ID (e.g. `F2` or `Multi-User Trip Management`).

## Setup

Identify the feature:
- If $ARGUMENTS is an F-number (e.g. `F2`): look it up in PLAN.md to get the feature name, status, and any linked design doc
- If $ARGUMENTS is a feature name: search PLAN.md for a matching row; if none, this is a brand-new feature

Read `DESIGN.md`, `CLAUDE.md`, and `docs/design/ui-guidelines.md` for architecture and UI context before proceeding.

## Mode Detection

Check for an existing design doc:
```bash
ls docs/design/F[N]-*.md 2>/dev/null    # if F-number known
# or check the design doc link in PLAN.md
```

If a doc is found, read its header comment (`<!-- ID: F[N] | Status: ... -->`) to determine whether it's a draft or finalized design:

| State | Mode |
|-------|------|
| No design doc found | **Fresh mode** |
| Design doc exists, `Status: Draft` | **Draft resumption** |
| Design doc exists, `Status: Designed` or later | **Update mode** |

**Draft status:** A doc marked `Status: Draft` is a work-in-progress design the user paused before it was considered final. PLAN.md will show the feature as `Backlog` with a `(draft)` annotation in the link column. Resume by reading the doc, identifying open questions and sections still needing resolution, and continuing the design conversation from there — do **not** run the full Update-mode staleness check unless the user asks for it.

---

## Fresh Mode

*Used when no design doc exists for this feature.*

### Step 1 — F-number assignment

If the feature is already in PLAN.md: use its existing F-number.

If not in PLAN.md:
- List `specs/F*.md` and `docs/design/F*.md` to find the highest F-number currently in use
- Assign the next number
- Add a row to PLAN.md with status `Backlog` (updated to `Designed` at the end)

### Step 2 — Context gathering

Read:
- `DESIGN.md` — architecture, data model, existing patterns
- `USER_SCENARIOS.md` — relevant user scenarios
- `docs/design/ui-guidelines.md` — established visual and interaction patterns
- Any related `docs/design/` files for features that interact with this one
- `IDEAS.md` — scan for shelved ideas relevant to this feature. If any apply, present them to the user during the design conversation as "previously shelved idea — worth incorporating?" The user decides: incorporate into design, keep shelved, or discard.

### Step 3 — Open questions

Identify the design questions that need resolution before a spec can be written. These typically include:
- UX decisions (how does the user interact with this?)
- Data model choices (new table vs. new column? nullable? scoping?)
- Scope boundaries (what's in V1 vs. deferred?)
- Integration points (which existing hooks/components does this touch?)
- Conflicts with existing patterns (does this require a new pattern?)

### Step 4 — Interactive design conversation

Run the conversation in two passes. Keep them distinct so UI preferences don't get buried under technical questions.

**Pass 1 — Functional/data decisions:**
- Data model choices (new table vs. column, nullable fields, scoping)
- Scope boundaries (what's in V1 vs. deferred)
- Integration points (which existing hooks, mutations, or React Query keys are involved)
- Undo/redo requirements
- Household scoping requirements

**Pass 2 — UI/interaction decisions:**

For each UI element the feature introduces, classify it against `docs/design/ui-guidelines.md`:

| Tier | What it means | Action |
|------|---------------|--------|
| **Established** | Matches a pattern already in ui-guidelines.md | Apply silently; note which guideline in the design doc |
| **Extension** | Similar to existing but with a new twist | Flag to user: "I plan to use the X pattern here — does that fit?" |
| **Novel** | No precedent in the app | Always discuss with user before deciding; this sets a new guideline |

Novel UI territory to always ask about:
- First use of a new interaction gesture (swipe, long-press beyond current uses)
- New component type (bottom sheet, date picker, multi-select, etc.)
- New screen-level layout pattern
- Visual treatment for a new semantic state (warning, success, error if not yet established)
- Any aesthetic choice with multiple reasonable options (icon selection, color assignment, label wording)

For each question:
- State the question clearly
- Propose options with trade-offs or show the established pattern
- Record the user's decision and rationale

**When novel UI decisions are made:** note them explicitly as "new pattern — update ui-guidelines.md" in the design doc. The Step 5 write will capture them in the design doc's Decisions section; Step 6 will propagate them to the guidelines.

Continue until all significant questions in both passes are resolved.

### Step 5 — Write the design doc

Write `docs/design/F[N]-[slug].md` with this structure:

If the user has indicated they want to review the doc before considering it final (common when open questions remain or a dependency blocks the feature), set the header to `Status: Draft` instead of `Status: Designed`. Draft docs keep the feature at `Backlog` in PLAN.md with a `(draft)` annotation in the link column. Otherwise use `Status: Designed`.

```markdown
# Design: [Feature Name]
<!-- ID: F[N] | Status: Designed -->  <!-- or: Status: Draft if user wants to review later -->

## Overview
[What this feature does and why — 2–4 sentences]

## User Scenarios
[Which scenarios from USER_SCENARIOS.md this addresses, quoted or paraphrased]

## Design Decisions

### [Decision topic]
**Decision:** [What was decided]
**Rationale:** [Why this approach]
**Alternatives considered:** [Other options weighed and why they were not chosen]

[Repeat for each significant design decision]

## Out of Scope
[Things deliberately excluded from this feature, with brief reason. These become BACKLOG.md candidates when the spec is written.]

## Open Questions
[Anything still unresolved. Should be empty before handing to /spec — if not, note what needs resolution.]
```

### Step 6 — Update PLAN.md and UI Guidelines

**PLAN.md:**
- If the design doc was written with `Status: Draft`: leave the feature at `Backlog` and note the doc link with a `(draft)` annotation, e.g. `[docs/design/F[N]-*.md](...) (draft)`
- If the design doc was written with `Status: Designed`: update status to `Designed` and add the design doc link
  - If the feature was not in PLAN.md: the row was added in Step 1
  - If already in PLAN.md as `Backlog`: update status to `Designed`

```
| F[N] | [Feature Name] | Designed | [docs/design/F[N]-[slug].md](docs/design/F[N]-[slug].md) | — |
```

(GitHub issue link stays `—` until `/spec` runs and creates the issue.)

**`docs/design/ui-guidelines.md`:**
For any decision flagged as "novel pattern" during Step 4, update the guidelines:
- If a TBD section is now resolved (e.g., first empty-state styling decision): fill in that section directly
- For other new patterns: append a row to the Decision Log at the bottom of the file:
  ```
  | [What was decided] | [Value/pattern chosen] | F[N] | [Brief rationale] |
  ```
The goal is that the next `/design` session picks up these decisions as "established" rather than re-opening them.

### Step 7 — Report

Summarize:
- Decisions made and recorded
- Anything deferred to Out of Scope (will become BACKLOG.md items at spec time)
- Open questions remaining, if any
- Next step: `/spec F[N]` when ready to write the implementation spec

---

## Update Mode

*Used when a design doc already exists for this feature.*

### Step 1 — Read the existing design doc

Read `docs/design/F[N]-[slug].md` (or the doc linked in PLAN.md).

Note existing decisions, scope boundaries, and any open questions.

### Step 2 — Staleness check

Compare the design doc's assumptions against the current codebase. Look for drift between what the design doc assumes about *existing* code and what's actually there:

- Extract mentioned file paths, function names, hook names, schema elements, and patterns from the doc
- Grep for these and read the relevant sections to verify they still match
- Focus on references to *existing* state — not future state that the feature will create
- Identify discrepancies: renamed things, removed functions, restructured files, changed data models

### Step 3 — Present findings to user

Report in two parts:

1. **Required changes** (staleness drift): "The design doc references X but the codebase now has Y — this needs updating"
2. Ask: "What desired changes would you like to make to the design?"

Combine both into a single interactive session — don't treat them as separate rounds.

### Step 4 — Interactive design update

For each required change and each desired change:
- Discuss options where non-obvious
- Record the decision and rationale
- Flag anything that may also affect an existing spec (`specs/F[N]-*.md`) — if a spec exists for this feature, note that it may need to be re-run after the design doc is updated

### Step 5 — Update the design doc

Revise `docs/design/F[N]-[slug].md` to reflect all changes. Add a revision history section if one doesn't exist, and append the new entry:

```markdown
## Revision History
- [YYYY-MM-DD]: Initial design
- [YYYY-MM-DD]: Updated — [brief summary of changes made]
```

### Step 6 — Update PLAN.md and UI Guidelines if needed

**PLAN.md:**
- If status was `Backlog` (design doc existed informally): update to `Designed` and add design doc link
- If status is already `Designed`, `Specced`, `In Progress`, etc.: leave status unchanged; the design doc update is noted in the revision history

**`docs/design/ui-guidelines.md`:**
Same rule as Fresh mode: if any novel UI patterns were decided during the update session, propagate them to the guidelines (fill TBD sections or append to Decision Log).

### Step 7 — Report

Summarize changes made and flag:
- Any open questions remaining before `/spec` can proceed
- Whether an existing spec (`specs/F[N]-*.md`) may now be out of date and needs re-running

---

## When Called on a Feature That Is Already Specced or Further Along

If the feature is `Specced`, `In Progress`, `In Review`, or `Done`:
- Still enter Update mode — the design doc should always reflect current intent
- After updating the design doc, assess impact:
  - Minor clarifications → note the update; no spec change needed
  - Decisions that change implementation scope → advise user that `/spec F[N]` should be re-run before the next implementation session
  - Feature is `Done` → note the update is for future reference only; no re-spec needed
