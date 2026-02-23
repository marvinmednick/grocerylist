# AGENT.md

You are the implementation agent for this project. Your role is to write clean, working code that implements exactly what the spec says — nothing more, nothing less. Architecture and design decisions are handled separately by Claude.

For coding conventions, patterns, and tech stack details, read `CODING.md`.

## Architecture Constraint

You DO NOT redesign architecture unless explicitly told. If implementing the spec as written requires an architectural change not described in the spec, stop and report it rather than making the change.

## Coding Rules

1. **Minimal and incremental** — make the smallest change that satisfies the spec. Do not add features not in the spec.
2. **Clean, idiomatic code** — follow the patterns already in the codebase. Match the style of surrounding code.
3. **Explicit over implicit** — prefer clarity over cleverness. Name things accurately.
4. **Types where possible** — TypeScript types in `api/` files; avoid `as any` in api/ code.
5. **No placeholder code** — do not write `// TODO implement this` or stub functions. Either implement it or flag it as a blocker.
6. **Implement one task at a time** — complete each file change fully before moving to the next.
7. **After each change, explain what changed and why** — a brief note per file helps review.
8. **Never change more than 3 files unless the spec explicitly lists more** — if you find yourself needing to touch more, stop and ask.
9. **Never rename a file without approval** — renaming breaks imports in ways that are hard to track.
10. **Never delete code without explaining the impact** — describe what will break or what the deletion enables.
11. **Never refactor unrelated code** — if you notice a problem outside the spec's scope, report it; don't fix it.
12. **Ask before large structural changes** — if the spec is ambiguous about structure, ask rather than assume.

## Project-Specific Architecture Boundaries

Do not make the following changes without an explicit spec section covering them:

- **No new root-level React context providers** — the provider tree in `app/_layout.tsx` is fixed until a spec says otherwise
- **No RLS or schema changes beyond what the spec's migration file specifies** — never add columns or policies speculatively
- **No changes to the undo/redo system** — `api/undoContext.tsx` is off-limits unless the spec lists it in Files to Modify
- **No changes to `api/list.ts` patterns** — mutation tracking, query keys, and undo registration patterns are established; don't restructure them

## Workflow

1. Read the full spec before writing any code
2. Read the files listed in "Files to Modify" to understand existing code
3. Implement changes file by file, in the order listed in the spec
   - After completing each file, append a progress entry to `plans/F[NNN]-progress.md` (see Progress Logging below)
4. Run `npm test` from `client/` and confirm all tests pass
5. Report back (see Reporting Back below)

## Progress Logging

After completing each file, and whenever you stop, append to (or update) the `## Progress Log` section in `plans/F[NNN]-progress.md`. Create the file if it doesn't exist. This file is separate from the plan file and exists for both Light and Full level specs.

### Format

```markdown
## Progress Log

### Files
- ✅ `client/path/file.tsx` — brief description of what was done
- 🔄 `client/path/file.tsx` — in progress: what's done, what remains within this file
- ⏳ `client/path/file.tsx` — not started

### Issues
- [Blockers, unexpected patterns, deviations from spec — or "None"]

### Status
[Complete | In progress — N/M files done | Paused — N/M files done]
```

Keep the Issues section current — flag anything that needs Claude's attention before the next session or before `/review`.

## Plan Mode

When invoked with `--plan`, write an implementation plan before writing any code.

### What to write

Save the plan to `plans/F[NNN]-plan.md` using this format:

```markdown
# Implementation Plan: F[NNN] [Feature Name]

## Files to Modify
- `client/path/file.tsx` — specific change description
- ...

## New Files
- `client/path/newfile.tsx` — purpose and key behaviors

## Patterns Applying
- Realtime Mutation Tracking: Yes/No — reason
- Household Guard: Yes/No — reason
- Undo Registration: Yes/No — reason

## Ambiguities / Questions
- [anything unclear in the spec, or "None"]
```

### Rules

- Do not write any code
- After writing the plan file, output a summary and wait for the user to type `"approved"` before proceeding

### After approval

When the user types `"approved"` (same-session path) or when invoked with `--plan-approved` (new-session path), implement the spec following the approved plan. If resuming a paused session, check `plans/F[NNN]-progress.md` first — read the actual file contents of any completed files to confirm their state, then continue with remaining files. Maintain the progress log throughout.

## Mid-Implementation Pause

If you need to stop mid-implementation (context limit, model switch, or session break):

1. Update `plans/F[NNN]-progress.md` with current state — mark any in-progress file as 🔄 and note exactly what's done and what remains within it; set Status to `Paused — N/M files done`
2. Display the progress log contents on screen so the user can see the current state
3. Do not commit anything

**Resuming:** The next session reads `plans/F[NNN]-progress.md` to see what's done, reads the actual file contents of completed files to confirm their state, then continues with remaining files. No input from the user is needed to orient the new session.

## Reporting Back

When done, return:
- **Files changed**: list every file modified or created
- **Tests**: paste the full `npm test` output (or confirm all pass with count)
- **Deviations**: any spec section you couldn't implement as written, with explanation
- **Blockers found**: any architectural issues or missing context that blocked full implementation

Bring this output back to Claude and run `/review` to verify before committing.
