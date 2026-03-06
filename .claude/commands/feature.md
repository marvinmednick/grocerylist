Capture and register a new feature idea. Input ($ARGUMENTS) is a rough description of the feature.

This is a lightweight idea-capture step — not a design session. The goal is to understand the user's intent well enough to write a clear GitHub issue and register the feature in PLAN.md. Technical design decisions (data model, implementation approach, UI patterns) are deferred to `/design` and `/spec`.

---

## Step 1 — Load context

Before responding to the user, read:
- `DESIGN.md` — current data model, architecture, and existing features
- `PLAN.md` — what features already exist or are already planned

This context is required to give an informed response. Do not skip it.

---

## Step 2 — Reflect and review

Summarize in 2–3 sentences what you understand the feature to be.

Then, based on your reading of DESIGN.md and PLAN.md, explicitly check for:

- **Already exists:** Does this feature (or a significant part of it) already exist in the product?
- **Already planned:** Is there an existing PLAN.md entry that covers this idea, even partially?
- **Inconsistency:** Does the request conflict with how the product currently works — a data model assumption that's wrong, a flow that doesn't match reality, or a description that doesn't align with an existing feature it references?
- **Ambiguity:** Is the request unclear in a way that could lead the conversation in two very different directions?

Flag any of these before asking refinement questions. Be specific: "This sounds similar to X which already exists — are you looking to extend that, or is this something different?" is more useful than a generic clarification request.

If nothing notable is flagged, say so briefly and move on.

---

## Step 3 — Clarifying conversation

Ask focused questions to fill gaps. Keep it conversational — ask at most 3–4 questions per turn. Pick from the list below based on what's missing; do not ask questions already answered in $ARGUMENTS.

**Good questions to ask (pick what's relevant):**
- Who uses this and in what situation? What does it let them do that they can't do today?
- What's the simplest version of this that would be useful?
- Is anything explicitly out of scope for this feature (vs. a follow-on)?
- Does this depend on another feature being built first?
- How does this fit with current priorities — is it something you want soon, or a future backlog item?

**Do NOT ask about:**
- Database schema, table structure, or column types
- Which files or components would be changed
- Undo/redo, household scoping, or React Query keys
- Exact UI component choices (button vs. modal, etc.)

After the user responds, incorporate their answers. If significant gaps remain, ask a follow-up round. If the idea feels well-captured, move to Step 4.

The user controls when to stop refining. If they say something like "that's good", "go ahead", or "register it", skip directly to Step 5.

---

## Step 4 — Propose a summary

Present a proposed GitHub issue description for the user's review:

```
**Title:** [concise feature name — no F-number yet]

**Summary:**
[2–3 sentences describing what the feature does and why it's useful]

**User scenario:**
[One sentence: who uses it and when]

**Scope:**
In scope: [what's included in this feature]
Out of scope: [what's explicitly deferred]

**Notes:**
[Any known constraints, dependencies on other features, or open questions — omit if none]

**Priority:** [Low / Medium / High — your best read from the conversation]
```

Ask: "Does this capture what you had in mind? Any changes before I register it?"

Incorporate feedback and re-present if needed. When the user confirms, proceed.

---

## Step 5 — Register

### 5a — Determine the next F-number

Read PLAN.md and find the highest F-number in the Active Features table:

```bash
grep "^| F" PLAN.md
```

The next feature gets the next integer.

### 5b — Create the GitHub issue

```bash
gh issue create \
  --title "F[N]: [feature name]" \
  --label "feature" \
  --label "effort:[small|medium|large]" \
  --body "..."
```

Choose the effort label based on the conversation:
- `effort:small` — touches 1–2 files, no schema change, no new screens
- `effort:medium` — multiple files, possible schema change, or new UI surface
- `effort:large` — new screens, significant schema change, or cross-cutting changes

### 5c — Add to PLAN.md

Add a row to the Active Features table:

```
| F[N] | [Feature Name] | Backlog | — | [#N](url) |
```

---

## Step 6 — Report

Confirm:
- F-number assigned
- GitHub issue URL
- PLAN.md updated

Suggest next steps:
- `/design F[N]` — if requirements need discussion or a design doc is warranted before speccing
- `/spec F[N]` — if the feature is simple enough to go straight to an implementation spec
