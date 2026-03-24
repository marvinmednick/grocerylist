Investigate a bug issue to understand its root cause without applying a fix. Input ($ARGUMENTS) is a GitHub issue number (e.g. `18`).

Investigation runs Phase 1 (locate) and Phase 2 (diagnose) from the bug process, documents findings on the issue, and stops. It does not assess blast radius, apply fixes, or write specs. After investigation, you can run `/resolve N` to fix, or defer/escalate based on the findings.

Use this when a bug has been logged but effort is `(unknown)` or `(estimated)` and you need to understand the root cause and true scope before deciding whether and when to fix it.

---

## Setup

```bash
gh issue view $ARGUMENTS --json number,title,body,labels
```

Read DESIGN.md and CLAUDE.md for architecture context.

Check existing state in the issue body:

- **Spec file exists** (`specs/I[N]-*.md`) → investigation is already complete; report this and stop. Run `/resolve N` to proceed to the fix.
- **`## Investigation Findings` section present AND effort is `(confirmed)`** → already investigated; report findings summary and stop.
- **Effort is `(confirmed)` in triage but no Findings section** → root cause is described in the issue body; extract and summarize it, then stop. No new investigation needed.
- **Otherwise** → proceed with Phase 1 and Phase 2 below.

---

## Phase 1 — Locate

Map the described behavior to a code path:
- Identify which screen, component, hook, or API call is involved
- Use Grep to search for relevant function names, strings, or patterns
- Read the likely entry-point files to trace the code path and confirm the location

**Phase 1 fails when:** the behavior is too vague to map to code, or no clear entry point can be found from static analysis.

→ If Phase 1 fails: update the issue with what was examined and why it couldn't be located. Recommend the user add reproduction steps or more detail. Stop.

---

## Phase 2 — Diagnose

Read the located files in depth:
- Trace the specific failure path through the code
- Identify the root cause
- Form a clear description of what the fix would look like (without committing to the fix here)

**Phase 2 fails when:** the code looks correct from static analysis and the root cause must involve runtime state, platform behavior, timing, or user data that cannot be observed statically.

→ If Phase 2 fails: update the issue with the located area and what static analysis ruled out. Note that runtime investigation is needed. Stop.

---

## Update the Issue

After Phase 1 + Phase 2, update the issue body with two sections:

**Update `## Triage`** — upgrade effort to `(confirmed)`:
```markdown
## Triage
- **Severity:** [existing value or newly assessed]
- **Effort:** [Small|Medium|Large] (confirmed) — [rationale based on what was just read]
- **Root Cause:** [one-sentence summary]
```

**Add `## Investigation Findings`** (after Triage, before any other sections):
```markdown
## Investigation Findings
- **Located:** `client/path/file.tsx:NN` — [what's there]
- **Root Cause:** [specific explanation of what's broken and why]
- **Fix Approach:** [what needs to change — enough that /resolve can go straight to Phase 3]
- **Affects:** [files and interfaces involved; any concerns about scope]
```

Apply or update labels:
```bash
gh issue edit N --add-label "severity:[high|medium|low]"
gh issue edit N --add-label "effort:[small|medium|large]"
```

---

## Output and Next Steps

Present the findings clearly, then offer options:

```
Investigation complete for #N: [title]

Root cause: [summary]
Effort: [Small|Medium|Large] (confirmed)

Options:
  /resolve N     — proceed to fix now
  defer          — leave for later; findings are saved on the issue
  escalate       — if the fix has architectural implications
```

---

## Design Review

After completing Phase 1 + Phase 2 and before updating the issue, check whether the root cause reveals a broader design principle:

- Does this bug suggest a pattern that should be avoided elsewhere?
- Does the located code reveal a design decision that was made incorrectly and may be repeated?

If yes: run `/design-review investigate` and document the finding in SESSION_NOTES.md before updating the GitHub issue. If the root cause is contained and specific, skip.

---

## What Investigation Does NOT Do

- Does not run Phase 3 (blast radius) — that happens in `/resolve`
- Does not apply any code fixes
- Does not write a spec
- Does not commit anything
