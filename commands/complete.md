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

First check whether a recent passing run already covers the current working tree:

```bash
# .last-test-output.txt is written by ./check-tests on every run
stat .last-test-output.txt 2>/dev/null
git log -1 --format="%ct" -- client/   # last commit time touching client/
```

If `.last-test-output.txt` is **newer** than the last commit that touched `client/` and that run recorded zero failures, the baseline is already verified — skip the test run and note "tests verified by recent /review-impl run."

Otherwise run the full suite:

```bash
./check-tests --show-known
```

If unexpected failures are found: stop and report them. Do not proceed until the baseline is clean. If failures are pre-existing and known, note them and continue.

---

## Step 2 — Commit

**For features (F[N]): check the progress file first.**

Read `plans/F[N]-progress.md`:
- If it does **not exist**: warn the user — it should always be created by the implementor (per AGENT.md). Do not proceed until this is resolved.
- If Status ≠ `Complete`: this is a **blocking** issue — the implementor has not finished. Stop and report.
- If Issues is non-empty: flag each item before proceeding — these may represent deviations or unresolved problems that affect the commit.

The progress file must be included in the commit (it is a permanent record of what was built).

Check what is staged and unstaged:
```bash
git status
git diff --staged
git diff
```

If there are no uncommitted changes (already committed): skip to Step 3.

Otherwise, review all changes and draft a commit message:
- Use `feat:` for features, `fix:` for bugs, `chore:` for cleanup/tasks
- Reference issues with plain `#[N]` (e.g. `refs #59, #60, #65`) for traceability — do **not** use `closes #N` in commit messages; GitHub's auto-close via commit keyword is unreliable for multiple issues and issues are closed explicitly in Step 3
- Summarize *what* was implemented, not just "closes issue"
- Subject line under 72 characters; use a body for meaningful detail

Present the suggested commit message and the specific files to stage (always include `plans/F[N]-progress.md` for features). Wait for user confirmation before running:
```bash
git add [specific files — never git add -A]
git commit -m "..."
```

---

## Step 3 — Close Issues and Update Tracking

**If this is a feature (F[N]):**

Read the spec file (`specs/F[N]-*.md`) and extract the `Closes:` field from the tracking metadata comment. This lists every issue to close (the tracking issue + any batched sub-issues). Close each one individually — do not rely on commit message keywords:

```bash
gh issue close [N] --comment "Implemented and reviewed."
# repeat for every issue number in the Closes: list
```

If the spec predates this `Closes:` field (older specs may lack it), check the spec body for a batched-issues table and close those manually as well.

Update the feature's Status in PLAN.md from `In Review` to `Done`.

Append a Shipped entry to `plans/F[N]-log.md`:
```markdown
## [DATE] — Shipped
- **Commit:** `[commit message subject]`
- **Closed:** #[N], #[M], ... (all issues from the Closes: field)
```

**If this is a non-feature issue:**
Close the single issue:
```bash
gh issue close [N] --comment "Implemented and reviewed."
```
No PLAN.md update needed.

---

## Step 3.5 — Design Review

Run `/design-review complete` as a closing check across the whole feature:

- Were any design decisions made during this feature's spec, review, or implementation?
- Did any patterns change or get established?
- Are docs (DESIGN.md, CODING.md, ui-guidelines.md) up to date with the current state?

If no design decisions were made this feature, skip this step.

---

## Step 4 — Triage BACKLOG.md

Read BACKLOG.md and list all open (unchecked `[ ]`) items.

If there are no open items: note this and skip to Step 5.

**Scope:** Only triage items related to the feature or issue being completed (identified by their `found in F[N] review`, `deferred from F[N]`, or similar tag). Leave items from other features/issues untouched — they'll be triaged when their own feature completes. Exception: if completing this feature makes an unrelated item obsolete, discard it now with a note.

For each in-scope item, propose one of three actions with a brief reason:

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

3. Update BACKLOG.md: remove triaged items (leave items from other features). If the backlog is now empty, replace the item list with:
   ```
   _(empty — all items triaged to GitHub Issues)_
   ```
   Commit the BACKLOG.md update (combine with fix-now commit if there is one, otherwise standalone):
   ```bash
   git add BACKLOG.md
   git commit -m "chore: triage backlog after [ID]"
   ```

**IDEAS.md scan:** After backlog triage, read IDEAS.md. If any shelved ideas are relevant to the feature just shipped (e.g., the feature enables or supersedes an idea), present them to the user:
- **Promote** → move to BACKLOG.md or create a GitHub issue
- **Keep** → leave in IDEAS.md
- **Discard** → remove (feature made it obsolete)

If no ideas are relevant, note "no relevant ideas" and continue. Include any IDEAS.md changes in the backlog triage commit.

---

## Step 4.5 — SESSION_NOTES Archive Check

Check whether SESSION_NOTES.md has grown large enough to archive:

```bash
wc -l SESSION_NOTES.md
```

If under 150 lines: skip this step.

If over 150 lines: move entries older than 90 days to a quarterly archive file. Determine the target quarter from the entry dates (Q1=Jan–Mar, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Oct–Dec):

```bash
# Archive destination — use the quarter of the oldest entries being moved
# e.g., docs/session-archive/2026-Q1.md
```

Create `docs/session-archive/` if it doesn't exist. Create the quarterly file if it doesn't exist (start it with a `# Session Archive — YYYY-QN` header). Move the older entries by cutting them from SESSION_NOTES.md and appending to the archive file. Keep the SESSION_NOTES.md header block (format/protocol description) intact.

Archive files are permanent — never delete them. They are the full history of session context for that period.

Commit SESSION_NOTES.md and the archive file together:
```bash
git add SESSION_NOTES.md docs/session-archive/
git commit -m "chore: archive SESSION_NOTES entries older than 90 days"
```

---

## Step 5 — Push

Check whether there are unpushed commits:
```bash
git log --oneline origin/main..HEAD
```

Report how many commits are unpushed. Pushing is not a gate — for solo development, all work is local and pushing is just a remote sync. Note the status and offer to push, but do not block completion on it.

If the user wants to push:
```bash
git push
```

---

## Done

Report a summary:
- **Shipped:** [ID] — [issue title] (closes #[N])
- **Backlog:** [empty / N items promoted to issues / N items fixed now]
- **New issues created:** list with numbers and titles (if any)
- **Unpushed:** N commits ahead of origin/main (if any)
