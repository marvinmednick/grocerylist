# AIDER.md

Setup and invocation guide for using aider as the implementation agent on this project.

## Prerequisites

aider reads `AGENT.md` and `CODING.md` automatically on every session (configured in `.aider.conf.yml`). You do not need to paste them manually.

## API Keys

Set whichever key(s) correspond to the model you plan to use:

```bash
export ANTHROPIC_API_KEY=...        # Claude models (Sonnet, Haiku, Opus)
export OPENAI_API_KEY=...           # GPT-4o, GPT-4.1
export OPENROUTER_API_KEY=...       # OpenRouter models (QWEN, Llama, etc.)
export GEMINI_API_KEY=...           # Gemini models via aider
```

## Model Selection

aider does not have a default model set in `.aider.conf.yml` — choose at runtime based on the task:

| Model flag | Best for |
|-----------|---------|
| `--model claude-sonnet-4-5` | Complex multi-file changes, strong TypeScript reasoning |
| `--model gpt-4o` | Fast general-purpose implementation |
| `--model openai/gpt-4.1` | Latest GPT-4 class tasks |
| `--model openrouter/qwen/qwen-2.5-coder-32b-instruct` | Code-focused tasks, cost-efficient |
| `--model gemini/gemini-2.0-flash` | Fast, large context window |

## Standard Invocation

The simplest way — use the `implement` script from the project root:

```bash
./implement F001 --tool aider --model <model-flag>
```

This automatically parses the file list from the spec and runs the right aider command.

### Manual invocation

```bash
aider --model <model-flag> \
  --read specs/F001-list-interactions.md \
  client/app/(tabs)/index.tsx \
  client/lib/household.tsx \
  client/components/UserAvatar.tsx
```

aider reads `AGENT.md` and `CODING.md` automatically via `.aider.conf.yml`. The spec is passed as `--read` (context-only, not edited). Files listed without `--read` are the ones aider will edit.

**The `implement` script** handles this automatically. The Implementation Commands section at the bottom of each spec also shows the manual command if needed.

## Adding Read-Only Context Files

Use `--read` for files that provide context but should NOT be edited:

```bash
aider --model <model-flag> \
  --read specs/F001-list-interactions.md \
  client/app/(tabs)/index.tsx \
  client/lib/household.tsx
```

Files listed without `--read` are editable. Files listed with `--read` are context-only.

## Context Management for Smaller Models

Smaller/faster models (QWEN, Haiku, Flash) have tighter effective context. To keep sessions focused:

1. **Add only the files in the spec's "Files to Modify" list** — don't add the whole project
2. **Use `/add` inside the session** to bring in additional files only when needed
3. **Break large specs into separate aider sessions** if the file list is long (>5 files)
4. For smaller models, paste `AGENT.md` and `CODING.md` content directly if the `--read` approach causes context overload

## Mid-Implementation Handoff

If aider needs to stop mid-spec (context limit or model switch), use the WIP commit convention:

```bash
# Inside aider session or from terminal:
git add [files changed so far]
git commit -m "wip: F[NNN] [description] — partial ([files done] done, [files remaining] remaining)"
```

To resume in a new session:
1. Read the WIP commit message to see where it stopped
2. Start a new aider session with the remaining files
3. Tell aider: "This is a continuation. The WIP commit covers [files]. Continue with [remaining files]."

## Reviewing aider's Output

Bring aider's output back to Claude and run `/review` to verify before committing:

```
/review F001
```

Or paste the diff directly into Claude.
