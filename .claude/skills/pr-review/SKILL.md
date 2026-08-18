---
name: pr-review
description: "Check out a GitHub PR from a pasted link or number, then run a full in-depth local review against this repo's conventions."
---

# Check Out and Review a GitHub PR

Triggered when the user pastes a GitHub PR link (or gives a bare PR number) and wants it
checked out locally and reviewed in depth — not just a diff read from GitHub, an actual local
checkout with the project's own verification tools run against it.

## Step 1 — Parse the target

Accept either a full URL (`https://github.com/<owner>/<repo>/pull/<number>`) or a bare number.
If a URL is given, note the `<owner>/<repo>` — if it doesn't match this repo (`WowUp/WowUp` or
whatever `git remote get-url origin` resolves to), it's a fork or an unrelated repo; `gh pr
checkout <number>` still works for forks of *this* repo without extra flags, but stop and ask if
the owner/repo looks unrelated entirely.

Confirm `gh` is available and authenticated first: `gh auth status`. If it's not authenticated,
tell the user to run `gh auth login` rather than trying to work around it.

## Step 2 — Preflight safety

Run `git status`. If there's uncommitted or untracked work, stash it (`git stash push -u -m
"pr-review: pre-checkout stash"`) rather than checking out over it — never discard it. Note the
current branch name (`git branch --show-current`) so it can be restored at hand-off.

## Step 3 — Check it out

```
gh pr checkout <number>
```

If checkout fails (e.g. a merged PR whose fork branch was deleted), fall back to reviewing the
diff without a working checkout: `gh pr diff <number>` plus `gh pr view <number> --json
baseRefName,headRefName,commits` for context, and say so explicitly in the hand-off — the review
in that case can't run local lint/tests.

## Step 4 — Get the build order right before running anything

Per this repo's `CLAUDE.md`, `wowup-lib` must be built before `wowup-electron` — the latter
depends on the local `wowup-lib-core` package. Check what the PR actually touches first
(`git diff --stat <base>...HEAD`, base from `gh pr view --json baseRefName`) so you don't rebuild
packages the PR doesn't touch:

```
cd wowup-lib && npm install && npm run build
cd ../wowup-electron && npm install && npm run build:lib
```

Only run the `wowup-lib` build if the PR touches `wowup-lib/`; only run `wowup-electron`'s
install/build:lib if the PR touches `wowup-electron/` and depends on lib changes.

## Step 5 — Run the project's own verification

From `wowup-electron/` (or wherever the PR's changes land):

```
npm run lint
npm test
```

Treat failures here as review findings, not a separate concern — a PR that fails lint or tests
is not done, regardless of how the code reads.

## Step 6 — Do the actual review

Two passes, not one:

1. **Delegate the correctness/simplification pass** to the `code-review` skill at effort `high`
   (matches "full in-depth"; escalate to `xhigh`/`max` only if the user asks for more, and point
   them at `/code-review ultra <PR#>` instead if they want the cloud multi-agent version — that
   doesn't need a local checkout at all):
   ```
   Skill(code-review, args="high <PR URL or number>")
   ```
2. **Layer on WowUp-specific checks** the generic reviewer won't know to look for, using the
   local checkout's full repo context (not just the diff):
   - Business logic landing in `wowup-electron/src/app/addon-providers/` or renderer
     `services/` that should instead be a Controller in `app/controllers/` per the UI Decoupling
     Plan (`wowup-electron/UI_DECOUPLING_PLAN.md`) — flag it, don't just note it in passing.
   - New user-facing strings added only to `en.json` and not propagated to the other 12 locale
     files in `wowup-electron/src/assets/i18n/` (English-placeholder is fine per existing
     convention, but the key must exist everywhere or missing-translation keys will show raw to
     non-English users).
   - Comments/abstractions that violate this repo's stated style (no explanatory comments unless
     the *why* is non-obvious, no premature abstraction, no error handling for scenarios that
     can't happen).
   - Commit message style if reviewing history too (present tense, imperative, under 72 chars).

## Step 7 — Hand off

Report: lint/test results, the `code-review` skill's findings, and your own WowUp-specific
findings, most-severe first. Remind the user they're currently checked out on the PR branch
(name it), and how to get back to where they were:

```
git checkout <original-branch>
git stash pop   # only if Step 2 stashed something
```

Don't switch back automatically — they may want to keep exploring the checked-out branch.
