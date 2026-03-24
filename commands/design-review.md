Run a design consistency check on a decision or change just made or discovered. Input ($ARGUMENTS) is optional context describing the finding (e.g. "spec", "review", "resolve", "investigate", "triage").

This command is embedded in other workflow commands at appropriate trigger points. It can also be run standalone any time a design decision has been made.

**If no design decision or change was made:** no action needed — stop here.

---

## Step 1 — Identify the change

What design decision, pattern change, or architectural finding was just made or discovered?

Be specific: name the component/pattern/rule, what changed, and in what context it was found.

**Check for prior findings in the same area** — before proceeding, grep SESSION_NOTES.md and `docs/session-archive/` for related terms. If this topic has come up before, that history informs the decision (recurring issues are stronger candidates for global fixes; prior deferred items may now be worth resolving):

```bash
grep -i "[key term]" SESSION_NOTES.md docs/session-archive/*.md 2>/dev/null
```

Also check `docs/design-history.md` for any prior decision that addressed this area.

---

## Step 2 — Locate existing usage

Where else in the codebase uses the previous approach?

Use Grep and targeted file reads to find all locations. Be thorough — the goal is to know the full scope before deciding.

---

## Step 3 — Consistency decision

Should this change apply globally?

**Default: YES** — consistent design is preferred over minimizing changes.

Accepting inconsistency requires a documented reason from this list:
- Platform-specific behavior (the old approach is correct for a different platform)
- Intentional semantic difference (the two locations have different enough purpose to warrant different approaches)
- Deliberate exception (explicitly decided and documented)

If keeping local: document the exception and the reason in SESSION_NOTES.md and stop.

---

## Step 4 — Scope and action

Determine the scope of applying the change globally:

- **Small (1–3 locations, low risk, <30 min):** Apply the fix in this session. Include in the current commit or a follow-up chore commit.
- **Larger or risky:** Create a GitHub issue or add to BACKLOG.md describing:
  - What needs to change
  - Why (the consistency principle it serves)
  - Where all the affected locations are (from Step 2)

  The work can be broken into phases, but the goal must be recorded and tracked. Do not simply accept the inconsistency without a tracking record.

---

## Step 5 — Update the docs

Check each document for needed updates:

| Document | Update when |
|----------|------------|
| `DESIGN.md` | Architecture, key patterns, or data model changed |
| `CODING.md` | A mandatory code pattern was added, changed, or removed |
| `docs/design/ui-guidelines.md` | A visual or interaction pattern was added or changed |
| `AGENT.md` | An implementor behavioral rule changed (rare) |
| `docs/design-history.md` | **Always when a design decision was made** — log what changed and why |
| `SESSION_NOTES.md` | **Always** — log the finding and outcome in the current session |

Also check: any active specs in `specs/` that reference the old approach?

---

## `docs/design-history.md` entry format

```markdown
## YYYY-MM-DD — [Short title] (source: F[N] / issue #N / session)

**Changed**: [What specifically changed — component, pattern, rule]
**Replaces**: [What the old approach was]
**Why**: [The reason — what problem it solved, what risk it eliminated]
**Generalized principle**: [The broader rule this decision reflects, if applicable; omit if purely specific]
**Scope applied**: [Where the change was applied this session; where deferred and why]
**Codified in**: [CODING.md §N / ui-guidelines.md §N / DESIGN.md — where the rule now lives, if anywhere]
```

**Two levels of learning — capture the right one:**
- *Specific*: tied to a particular component or technology (e.g., "FlatList mock requires `__esModule: true`")
- *General principle*: applies broadly across the codebase (e.g., "Absolute-positioned overlays with hardcoded px offsets are fragile — use Modal")

If the finding generalizes, fill in "Generalized principle." If it's specific and doesn't generalize, omit that field.
