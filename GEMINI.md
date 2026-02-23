# GEMINI.md

Gemini-specific guidance for this project. This file is auto-loaded by Gemini CLI as a system prompt (via `.gemini/settings.json`, which also auto-loads `AGENT.md` and `CODING.md`).

> **Full process guide:** `WORKFLOW.md`

## Starting an Implementation

The simplest way — use the `implement` script from the project root:

```bash
./implement F001
```

This finds the spec, builds the right command, and runs it.

For **Full review level** specs, run the plan step first:

```bash
./implement F001 --plan          # write plan to plans/F001-plan.md, wait for approval
./implement F001 --plan-approved # implement using the approved plan (new-session path)
```

### Manual invocation

If running Gemini CLI directly, AGENT.md and CODING.md are already loaded — just point at the spec:

```bash
gemini "Implement specs/F001-list-interactions.md. Run npm test from client/ when done. List all files changed and paste the full test output."
```

### Copy-paste (AI Studio or other web interface — not needed for Gemini CLI)

Paste in this order:
1. Full contents of `AGENT.md`
2. Full contents of `CODING.md`
3. Full contents of the spec file (`specs/[feature-slug].md`)
4. Any source files the spec says to modify

Then append:
> "Implement the spec above following the conventions in AGENT.md and CODING.md. Run all tests and confirm they pass before reporting back. List every file you changed."

## What to Report Back

- Every file changed (diffs or full file contents)
- Test output confirming all tests pass
- Any spec sections that couldn't be implemented as written, with explanation

Bring the output back to Claude and run `/review` to verify before committing.
