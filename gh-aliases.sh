#!/usr/bin/env bash
# Grocery app GitHub issue aliases
# Usage: source gh-aliases.sh
# Requires: gh CLI authenticated

REPO="marvinmednick/grocerylist"

# All open issues (default view)
alias gi='gh issue list --state open'

# Unbatched open issues — what still needs planning
alias gi-open='gh search issues --repo '"$REPO"' --state open "NOT label:batched"'

# All batched issues (across all features)
alias gi-batched='gh issue list --label batched'

# Issues in a specific batch — e.g. gi-batch B76 (all issues batched into #76)
alias gi-batch='gh issue list --label'

# Open bugs only
alias gi-bugs='gh issue list --label bug --state open'

# Issues with no labels — good triage starting point
alias gi-triage='gh search issues --repo '"$REPO"' --state open "no:label"'
