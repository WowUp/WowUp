---
name: commit
description: "Commit whatever is currently staged, with a message drafted from the staged diff and this repo's commit style."
---

# Commit Staged Changes

Commit **only what's already staged** — never stage anything yourself (`git add`, `git add -A`,
`git add .`) unless the user explicitly asks for that in this same turn. If the user wants
different files included, tell them to stage them (or ask which files) rather than guessing.

## Step 1 — Look at what's staged

Run these in parallel:
- `git status` — see staged vs. unstaged/untracked, so you don't confuse the two
- `git diff --staged` — the actual content to summarize
- `git log --oneline -10` — recent commit style to match

If `git diff --staged` is empty, stop and tell the user nothing is staged. Don't stage
anything for them, don't commit an empty change.

## Step 2 — Sanity-check what's staged

Before drafting a message:
- If any staged file looks like it could hold secrets (`.env`, `credentials.json`, `*.pem`,
  API keys, tokens) even from an innocuous-looking name, open it and check before proceeding.
  Warn the user and ask before committing if it looks sensitive.
- If the staged diff mixes clearly unrelated changes (e.g. an unrelated formatting pass bundled
  with a real fix), flag it to the user instead of silently writing one message that papers over
  two different changes.

## Step 3 — Draft the message

Follow this repo's convention from `CLAUDE.md`:
- Present tense, imperative mood ("Add raiderio provider", not "Added raiderio provider")
- Subject line under 72 characters
- Focus on *why*, not a restatement of the diff — 1-2 sentences is enough; only add a body if the
  reasoning isn't obvious from the subject alone
- Match the tone/format of the last few `git log` entries rather than inventing a new style

## Step 4 — Commit

```
git commit -m "$(cat <<'EOF'
<subject>

<optional body>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Then run `git status` to confirm the commit succeeded and the working tree is what's expected.

If a pre-commit hook fails: fix the underlying issue, re-stage the fix, and create a **new**
commit — never `--amend` (the failed commit never happened, so amend would rewrite the prior
commit instead) and never `--no-verify` to skip the hook.

## Step 5 — Hand off

Report the commit hash and subject line. Don't push — that's a separate, explicit ask.
