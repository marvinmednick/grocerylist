Complete and ship a feature or non-feature issue. Input ($ARGUMENTS) is a feature ID (F1) or GitHub issue number (42).

## Setup

Determine the type from $ARGUMENTS:

**Feature ID (F[N]):** Look up the GitHub issue number from the PLAN.md row for this feature. This is a feature completion — PLAN.md will need updating.

**GitHub issue number:** Treat as a non-feature issue (bug, cleanup, task, etc.). No PLAN.md row to update.

Fetch the issue for context:
```bash
gh issue view [N] --json number,title,body,labels 2>/dev/null
```

---

## Step 1 — Verify Tests

Run the test suite to confirm the baseline is clean before committing:

```bash
./check-tests --show-known
```

If unexpected failures are found: stop and report them. Do not proceed until the baseline is clean. If failures are pre-existing and known, note them and continue.

---

## Step 2 — Commit

Check what is staged and unstaged:
```bash
git status
git diff --staged
git diff
```

If there are no uncommitted changes (already committed): skip to Step 3.

Otherwise, review all changes and draft a commit message:
- Use `feat:` for features, `fix:` for bugs, `chore:` for cleanup/tasks
- Include `closes #[N]` to cross-reference the GitHub issue
- Summarize *what* was implemented, not just "closes issue"
- Subject line under 72 characters; use a body for meaningful detail

Present the suggested commit message and the specific files to stage. Wait for user confirmation before running:
```bash
git add [specific files — never git add -A]
git commit -m "..."
```

---

## Step 3 — Close Issue and Update Tracking

Close the GitHub issue with a brief closing comment:
```bash
gh issue close [N] --comment "Implemented and reviewed."
```

**If this is a feature (F[N]):**
Update the feature's Status in PLAN.md from `In Review` to `Done`.

**If this is a non-feature issue:**
No PLAN.md update needed.

---

## Step 4 — Triage BACKLOG.md

Read BACKLOG.md and list all open (unchecked `[ ]`) items.

If there are no open items: note this and skip to Step 5.

For each open item, propose one of three actions with a brief reason:

- **Fix now** — 1–5 line change, low risk, clearly scoped. Apply in this session.
- **Promote to GitHub Issue** — non-trivial, needs its own work session, or useful to track. Pick a label: `bug`, `enhancement`, `cleanup`, `test-quality`, or `docs`.
- **Discard** — no longer relevant given recent changes.

Present the full triage plan to the user before taking any action. Once confirmed:

1. Apply any "fix now" items, then commit them together:
   ```bash
   git add [specific files]
   git commit -m "chore: [description] (backlog triage after [ID])"
   ```

2. Create GitHub issues for promoted items:
   ```bash
   gh issue create --title "..." --label "..." --body "..."
   ```

3. Update BACKLOG.md: remove all triaged items. If the backlog is now empty, replace the contents with:
   ```
   _(empty — all items triaged to GitHub Issues)_
   ```
   Commit the BACKLOG.md update (combine with fix-now commit if there is one, otherwise standalone):
   ```bash
   git add BACKLOG.md
   git commit -m "chore: triage backlog after [ID]"
   ```

---

## Step 5 — Push

Push the commits to remote:
```bash
git push
```

Present this step explicitly and wait for confirmation before running — pushing affects the shared remote.

---

## Done

Report a summary:
- **Shipped:** [ID] — [issue title] (closes #[N])
- **Backlog:** [empty / N items promoted to issues / N items fixed now]
- **New issues created:** list with numbers and titles (if any)
