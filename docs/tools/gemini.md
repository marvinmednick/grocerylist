# Gemini CLI — Invocation Reference

Human reference for running Gemini as the implementation agent on this project.

> **Full process guide:** `WORKFLOW.md`

## API Key

```bash
export GEMINI_API_KEY=...
```

## Starting an Implementation

Use the `implement` script from the project root:

```bash
./implement F1 --tool gemini
```

`AGENT.md` and `CODING.md` are auto-loaded via `.gemini/settings.json`.

For **Full review level** specs, run the plan step first:

```bash
./implement F1 --tool gemini --plan     # write plan to plans/F1-plan.md
./implement F1 --tool gemini            # implement using the approved plan
```

## Manual Invocation

If running Gemini CLI directly, `AGENT.md` and `CODING.md` are auto-loaded — just point at the spec:

```bash
gemini "Implement specs/F1-list-interactions.md. Run npm test from client/ when done. List all files changed and paste the full test output."
```

## Copy-Paste (AI Studio or other web UI)

Paste in this order:
1. Full contents of `AGENT.md`
2. Full contents of `CODING.md`
3. Full contents of the spec file (`specs/[feature-slug].md`)
4. Any source files the spec says to modify

Then append:
> "Implement the spec above following the conventions in AGENT.md and CODING.md. Run all tests and confirm they pass before reporting back. List every file you changed."
