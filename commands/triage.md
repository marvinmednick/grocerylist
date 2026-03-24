Triage one or more bug issues. Input ($ARGUMENTS) is one or more GitHub issue numbers (e.g. `18` or `18 19 20`). If no arguments are given, list all open `bug`-labeled issues and triage each one.

Triage assesses **severity** (always determinable from description) and **effort** (estimated from what's available, with minimal code examination). It does not investigate root causes or apply fixes.

---

## Setup

Parse $ARGUMENTS as a space-separated list of issue numbers. If empty:
```bash
gh issue list --label bug --state open --json number,title,labels | jq '.[] | "\(.number) \(.title)"'
```
Triage each issue in sequence.

For each issue number N:
```bash
gh issue view N --json number,title,body,labels
```

Read DESIGN.md and CLAUDE.md briefly for architecture context (skim, don't deep-read).

---

## For Each Issue

### Step 1 — Check Existing Triage

Read the issue body for a `## Triage` section.

- If the section exists and effort is `(confirmed)` → skip this issue; report "already fully triaged"
- If the section exists but effort is `(unknown)` or `(estimated)` → proceed; attempt to upgrade the effort assessment
- If no section → proceed with full triage

---

### Step 2 — Assess Severity

Severity is always determinable from the issue description alone. No code examination needed.

| Severity | When |
|----------|------|
| **High** | Data integrity risk, security, app crash, or no workaround |
| **Medium** | Incorrect visible behavior, functional workaround exists |
| **Low** | Cosmetic, edge case, rare sequence, or UX minor issue |

Write a one-line rationale explaining the impact.

---

### Step 3 — Assess Effort

Effort depends on understanding the cause. Use whatever is already available before reaching for code.

**Use the issue body first:**
- If the issue already describes the root cause and affected file(s) → assess effort from that; mark `(confirmed)` if the fix approach is clear, `(estimated)` if the scope is plausible but not verified
- If the issue contains a fix sketch → mark `(confirmed)`

**Quick code look (allowed — strictly limited):**
If the issue doesn't describe the cause but names a component, function, or file:
- Run one Grep to locate it
- Read at most 2 files, at most 30 lines each
- If the fix scope is now clear → `(estimated)`
- If not → stop; mark `(unknown)`

**Do not:**
- Trace code paths across multiple files
- Read large files in depth
- Run Phase 1 or Phase 2 investigation
- Spend more than ~2 minutes of examination per issue

| Effort | When |
|--------|------|
| **Small** | ~10 lines, 1–2 files, no new test files, no interface changes |
| **Medium** | Multiple files, some test changes, or a spec likely needed |
| **Large** | Architectural, schema changes, many files, or extensive tests |

| Qualifier | Meaning |
|-----------|---------|
| `(confirmed)` | Root cause read or described in issue; fix scope verified |
| `(estimated)` | Quick code look supports this estimate; not fully traced |
| `(unknown)` | Insufficient information to assess without full investigation |

---

### Step 4 — Update the Issue

Update the issue body: add or replace the `## Triage` section at the top of the body (before any other sections):

```markdown
## Triage
- **Severity:** [High|Medium|Low] — [one-line impact rationale]
- **Effort:** [Small|Medium|Large] ([confirmed|estimated|unknown]) — [one-line rationale, or "not yet investigated"]
- **Root Cause:** [Brief description if known from issue or quick look, or "not yet investigated"]
```

```bash
# Fetch current body, prepend/replace triage section, update
gh issue edit N --body "..."
```

Apply labels:
```bash
gh issue edit N --add-label "severity:[high|medium|low]"
# Only add effort label if not unknown:
gh issue edit N --add-label "effort:[small|medium|large]"
```

---

## Output

After all issues are processed, print a summary table:

```
| #  | Severity | Effort           | Recommendation         |
|----|----------|------------------|------------------------|
| 18 | Medium   | Small (confirmed)| Fix — well understood  |
| 19 | Low      | Unknown          | Investigate before scheduling |
```

**Recommendation guidance:**
- Severity high + any effort → flag for immediate attention
- Effort (confirmed) or (estimated) → can be scheduled for `/resolve`
- Effort (unknown) → recommend `/investigate N` before scheduling
- Severity low + effort large → consider deferring or closing as won't-fix

---

## Pattern Check

After triaging all issues, scan for systemic patterns:

- Do 2 or more bugs share the same component, root cause type, or violated pattern?
- Does a cluster of bugs suggest an approach that should change globally?

If yes: run `/design-review triage` to assess whether a general principle needs updating or a broader fix should be tracked. If bugs are all independent and specific, skip.

---

## What Triage Does NOT Do

- Does not apply any code fixes
- Does not run Phase 1 (locate) or Phase 2 (diagnose) investigation
- Does not write specs
- Does not commit anything
