---
name: pr-score
description: "Review a WowUp client PR from a pasted link or number and score whether it should be merged: hard gates, a weighted 0-100 score, and a merge verdict."
---

# Score a WowUp PR for Merge

Triggered when the user pastes a GitHub PR link (or bare number) and asks whether it should be
merged, wants a score, or wants a merge recommendation. This builds on the `pr-review` skill —
that skill gathers the evidence, this one turns it into a decision.

The verdict must be auditable: every deduction cites evidence (`file:line`, a command's output,
or PR metadata). Never deduct on a hunch.

## Step 1 — Gather metadata

```
gh pr view <number> --repo WowUp/WowUp --json title,author,baseRefName,headRefName,isCrossRepository,mergeable,mergeStateStatus,additions,deletions,changedFiles,files,statusCheckRollup,closingIssuesReferences,body,commits
```

Note in particular:
- **CI state.** An empty `statusCheckRollup` on a fork PR means CI never ran (workflows await
  approval) — that is *not* a pass. Local lint/test is then the only evidence; say so.
- **Base branch.** Should be `develop`. `master` is only valid from `release/X.Y.Z`. A
  `release/*` base is only right for a fix meant for that release; features and refactors
  belong on `develop`. Also check the PR body agrees with the actual base — a mismatch means
  the author or a maintainer changed it, so surface it for the user to decide.
- **Fork vs branch.** `isCrossRepository: true` means an external contributor.
- **Merge state.** `mergeStateStatus: DIRTY` can be stale for fork PRs (seen alongside
  `mergeable: MERGEABLE`). Confirm locally with
  `git merge-tree --write-tree origin/<base> <pr-branch>` before treating it as a conflict.
- **Existing reviews.** Read `reviews` and `comments` (`gh pr view --json reviews,comments`).
  Don't count approvals from accounts with no tie to the project — check suspicious ones with
  `gh api users/<login>` (new account, no followers, a bare link in the review body = spam). Flag
  them under Risks so the maintainer can hide/report them; never act on them yourself.

## Step 2 — Run the full review

Invoke `pr-review` (checkout, build order, `npm run lint`, `npm test`, `code-review` at `high`,
WowUp-specific checks). Don't redo its steps here; take its findings as input.

If the user says a review was already run in this conversation, reuse those findings instead of
re-running it.

**Re-scoring a PR scored before** (it's in the Calibration list below, or earlier in the
conversation): compare its commits, base and head SHA with the last run. If the code is
unchanged apart from merges from upstream, don't re-run `code-review` — check each merge's
conflict resolution with `git show --remerge-diff <merge-sha>`, then re-run lint/tests on the
current base (it may have moved) and re-apply deductions that depended on the base (e.g. "spec
doesn't run on `develop`"). Report what changed since the last score.

Additionally, while checked out:
- **Trial-merge into both `develop` and `origin/master`** (`git merge --no-commit --no-ff`,
  then `git merge --abort`) — `develop` regularly drifts behind `master` between releases, so a
  PR that's clean against `develop` can still conflict at release time. Report it as a risk, not
  a gate, unless it conflicts with its own base.
- If the PR touches packaging (`wowup-shell/`, `electron-build/`, `package.json` deps), run
  `npm run build:prod` in `wowup-electron/`.

### Where to run lint/tests

Before running `test:main`, delete `wowup-electron/out-tsc/app-spec` (gitignored build output).
`tsc` never removes old output, so compiled specs from a previous PR's checkout stay there and
mocha runs them — e.g. a leftover `app-menu.spec.js` failing with "is not a function" against a
branch that doesn't export it.

The installed `node_modules` track the newest branch (usually the current `release/X.Y.Z`), and
`develop`/`master` can lag it badly — e.g. `develop` may have no main-process mocha setup at all,
and an older `master` still expects `electron-log` in `wowup-electron`, so `test:main` fails to
compile for reasons unrelated to the PR. If lint/tests fail on the PR branch with errors in files
the PR doesn't touch:

1. Create a throwaway branch from the newest release branch (`git checkout -B
   pr-score/<n>-on-release release/X.Y.Z`), `git merge --no-commit --no-ff <pr-branch>`.
2. Resolve trivial conflicts only (keep both sides' intent); if a conflict needs real judgement,
   stop and report it instead.
3. Run lint and the full test suite there, and say in the report which branch they ran on.
4. Clean up: `git merge --abort`, return to the PR or original branch, `git branch -D` the
   throwaway branch. Write logs to the scratchpad, never outside the repo.

### Check new specs actually run

For every spec file the PR adds, confirm the **base branch's** test command picks it up — e.g. on
`develop`, `npm test` is karma over `src/**/*.spec.ts` only, so a new `app/*.spec.ts` (mocha)
silently never runs there. Run it explicitly (`npx mocha --grep "<describe name>"` with
`NODE_PATH=../wowup-shell/node_modules`) to prove it passes, and deduct under Tests if the base
branch won't run it.

## Step 3 — Hard gates

Any failing gate makes the verdict **Do not merge** regardless of score. Still compute the score
so the author knows what else to fix.

| Gate | Fails when |
|---|---|
| Lint | `npm run lint` fails in any package the PR touches |
| Tests | `npm test` fails (ignore failures that also fail on the base branch — verify, then note them) |
| Build | A build the PR could affect fails |
| Base branch | Targets `master` from a non-`release/*` branch, or targets a `release/*` branch with a feature/refactor rather than a fix for that release (fixable: "retarget to `develop`" — confirm it merges cleanly there) |
| Conflicts | `mergeable` is `CONFLICTING` against its own base |
| Shell/signing | Changes to `wowup-shell/`, `electron-build/`, updater config, or `app/bundle-paths.ts` with no explanation in the PR body |
| Dependencies | New deps unpinned, or shell-only deps (`electron-log`, `electron-updater`, `win-ca`) installed in `wowup-electron` |

## Step 4 — Weighted score (0-100)

Score each category from its max down; list each deduction with its evidence.

| Category | Max | What to check |
|---|---|---|
| Correctness | 30 | `code-review` findings: −15 per likely bug in a main path, −8 per edge-case bug, −3 per minor issue |
| Architecture fit | 15 | New business logic in renderer `services/` or `addon-providers/` that belongs in a Controller (`UI_DECOUPLING_PLAN.md`); `app.getAppPath()`/`__dirname` instead of `bundle-paths.ts`; logic in `src/app/services/api/` wrappers; contracts outside `src/common/api/contracts/` |
| Tests | 15 | New/changed logic has specs; specs assert behaviour rather than just executing code; main-process code has mocha specs, renderer has karma specs |
| Scope & risk | 10 | Diff is focused on its stated purpose; unrelated changes; high-blast-radius areas (main process startup, updater, addon install/remove, file deletion) touched without matching tests |
| i18n | 10 | New keys in all 13 files under `src/assets/i18n/`; no hard-coded user-facing strings. Give full credit when done right |
| Cross-platform | 10 | Judge only platforms the change can affect: platform-specific code doesn't break others; paths/case-sensitivity; Overwolf flavor (`environment.*.ow.ts`, `ow:` scripts) still consistent |
| Conventions | 5 | Prettier, strict TS (no new `any`/`@ts-ignore` without reason), commit style (imperative, < 72 chars), comment density matches surrounding code |
| PR hygiene | 5 | Clear description, linked issue, stated testing, notes for maintainers where relevant |

Rules:
- Don't double-count: a finding is deducted in one category only.
- Don't penalise for platforms or areas the change cannot affect.
- AI-assisted authorship is neither a bonus nor a penalty — judge the code. It *is* a reason to
  check that tests genuinely assert behaviour and that described manual testing is plausible.
- First-time/external contributors get the same score; only the tone of any posted comment changes.

**Verdict bands**

| Score | Verdict |
|---|---|
| 85-100 | **Merge** |
| 70-84 | **Merge after minor fixes** |
| 50-69 | **Needs changes** |
| < 50 | **Reject / rethink approach** |

## Step 5 — Recommendation

Turn the verdict into one recommended action. Exactly one of:

| Action | When |
|---|---|
| **Merge** | Gates pass, score ≥ 85, and no blocking change to propose |
| **Merge with follow-up** | Gates pass, score ≥ 85, remaining items are nice-to-haves a maintainer could do (or track) after merging — list them as follow-ups |
| **Request changes** | Any fixable gate failure, score 50-84, or any blocking change to propose |
| **Close / redirect** | Score < 50, or the approach conflicts with the project's direction (e.g. new renderer business logic the UI Decoupling Plan is moving out) — say what approach would be accepted instead |

Base the call on the findings, not the number alone: a single blocking change means **Request
changes** even at 95. Say in one sentence why this action and not the next one over.

For **Request changes** (and for any nice-to-haves), write each proposed change so the author
can act on it without asking:

- **What and where:** the file and line (`path:line`), or the PR-level action (retarget base,
  rebase, split the PR).
- **Why:** the finding it fixes, tied to its gate or score deduction.
- **How:** a concrete suggestion — a short code snippet or ` ```suggestion ` block for small
  edits, the exact command for branch/base fixes, or the spec cases to add (names and what each
  asserts) for missing tests. Write snippets against the PR's actual code; check they compile
  in your head against the surrounding types. Keep each to what fixes the finding — no drive-by
  refactors.
- **Size:** blocking or optional.

Order: blocking first, then optional. If a change is something a maintainer would rather do
themselves while merging (a one-line nit, a base retarget they can do in the GitHub UI), say so
— that can turn **Request changes** into **Merge with follow-up**.

## Step 6 — Report

Print in the terminal:

```
## PR #<n> — <title>
Recommendation: <Merge | Merge with follow-up | Request changes | Close / redirect>
Verdict: <verdict>   Score: <n>/100   Gates: <passed | FAILED: ...>
<one sentence: why this action>

### Proposed changes
<numbered; each with where, why, how (snippet/command/spec cases), blocking or optional.
 Omit this section for a plain Merge.>

### Gates
<each gate: pass/fail/n.a. with evidence>

### Score
| Category | Score | Deductions |
...

### Risks / maintainer notes
<merge drift vs master, CI not run, untested platforms, ...>
```

State how the correctness pass was done: via `code-review`, or by hand for small diffs (mostly
locale/config files) — say which.

Then remind the user which branch they're on, as `pr-review` does. If you created throwaway
branches or stashed work, put the user back on their original branch with the stash popped,
and say the PR branch is still available locally.

## Step 7 — Posting (opt-in only)

Only if the user passed `--post` or asks: draft a PR comment from the report (friendly tone for
external contributors, the proposed changes first with their snippets, no raw score table unless
asked), show it to the user, and post with `gh pr comment <number> --repo WowUp/WowUp
--body-file <file>` only after they confirm. Never approve, request changes, or merge on the
user's behalf — the recommendation is advice; the user takes the action.

## Calibration

When weights feel off, score 3-4 already merged or closed PRs and compare against what actually
happened; adjust the deduction sizes above rather than adding ad-hoc exceptions.

Scored so far:

- **PR 1601** (macOS app/window menu roles; fork, CI not run): 97/100, Merge. −3 Tests because
  the new mocha spec doesn't run on `develop`. Clean against `develop`; trivial `app-menu.ts`
  conflict against `master`. Tests run on `release/2.25.0` + PR.
  **Re-scored 2026-11-01:** 99/100, Merge. Author retargeted to `release/2.25.0` (valid: macOS
  shortcut fix) and merged upstream in; conflict resolution checked via `--remerge-diff`. The −3
  Tests went away (release runs mocha); −1 Hygiene for the body's stale `develop` maintainer note.
  Two approvals from a spam account were flagged, not counted.
- **PR 1600** (remove sync store IPC; fork, CI not run): 94/100, Merge after retargeting from
  `release/2.25.0` to `develop` (refactor mid-beta; body claimed `develop`). −3 Tests (async
  `loadInstallId` unspecced), −2 Scope (preload/startup change, app not launched), −1 Hygiene
  (body/base mismatch). Under the updated gate this base would now fail as fixable.
  Recommendation: **Request changes** (retarget to `develop`; optional `loadInstallId` spec) —
  or **Merge with follow-up** if the maintainer retargets it themselves.
