# Codex CLI — Invocation Reference

Human reference for running Codex as the implementation agent on this project.

> **Full process guide:** `WORKFLOW.md`

## API Key

```bash
export CODEX_API_KEY=...    # or OPENAI_API_KEY
```

## Starting an Implementation

Use the `implement` script from the project root:

```bash
./implement F1              # uses codex (project default in .implement.conf)
./implement F1 --tool codex # explicit
```

`AGENTS.md` is auto-loaded by Codex. The `implement` script also injects an explicit
instruction to read `AGENT.md` and `CODING.md` before making any changes.

For **Full review level** specs, run the plan step first:

```bash
./implement F1 --plan    # write plan to plans/F1-plan.md
./implement F1           # implement using the approved plan
```

## Model Selection

Default model is set in `.implement.conf` and `.codex/config.toml`. Override at runtime:

```bash
./implement F1 --model o4-mini
./implement F1 --model gpt-4.1

# Or per-session via env var:
export IMPLEMENT_MODEL=o4-mini
./implement F1
```

## Manual Invocation

```bash
codex exec -a never -s workspace-write \
  "First read AGENT.md and CODING.md in full. Confirm you have read both before making any changes. Implement specs/F1-list-interactions.md. Run npm test from client/ when done. List all files changed and paste the full test output."
```

## Copy-Paste (ChatGPT or other web UI)

Paste in this order:
1. Full contents of `AGENT.md`
2. Full contents of `CODING.md`
3. Full contents of the spec file (`specs/[feature-slug].md`)
4. Any source files the spec says to modify

Then append:
> "Implement the spec above following the conventions in AGENT.md and CODING.md. Run all tests and confirm they pass before reporting back. List every file you changed."
