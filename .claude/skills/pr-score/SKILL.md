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
- **PR 1555** (3 bundled fixes on stale `release/2.22.1`; fork, CI not run; scored 2026-11-06):
  73/100, gate FAILED (base). −15 Correctness: its `browser_download_url` change conflicts with
  and would undo `develop`'s #1248 fix (`e70bfe45`, private repos). Lint/tests run on `develop` +
  PR with that hunk dropped. Recommendation: **Request changes** (retarget, drop commit 2).
  **Re-scored 2026-11-06:** maintainer retargeted to `develop`; commits unchanged. Base gate now
  passes but Conflicts fails: `github-addon-provider.ts` (commit 2) and a one-line `locales.spec.ts`
  clash with `develop`'s `6be5cf20` (adds `pl`). Score unchanged at 73. Lint + full `npm test`
  pass on `develop` + PR (commit 2 dropped, both sides kept in the spec). Recommendation:
  **Request changes** (rebase, drop commit 2) — or maintainer cherry-picks commits 1 and 3.
- **PR 1542** (macOS `LSApplicationCategoryType` games → utilities; 4 lines, fork, CI not run;
  scored 2026-11-06): 97/100, Merge with follow-up. Paths are pre-move `wowup-electron/electron-build/`;
  GitHub says CONFLICTING (stale merge ref) but `git merge-tree` against `develop` and `master`
  is clean — rename detection lands it in `wowup-shell/electron-build/`. Lint/tests/build not run
  (JSON only, read by mac electron-builder alone); JSON parse checked. −1 Conventions (4 web-UI
  "Update <file>.json" commits, squash), −2 Hygiene (no stated testing, no issue). Maintainer
  merges locally since GitHub's button is blocked.
- **PR 1541** (GitHub `getByIdAsync` → `browser_download_url`; 1 line, fork, CI not run; scored
  2026-11-06): 75/100, gate FAILED (Conflicts vs `develop` and `master`). Hunk is identical to
  `1f72318f` (#1568), already superseded by `e70bfe45` (Accept header fix, shipped v2.24.0,
  #1520 closed). −15 Correctness (would re-break private repos), −5 Tests, −2 Conventions,
  −3 Hygiene. Lint/tests not run: the only valid resolution keeps `develop`'s side, so the PR
  becomes empty. Recommendation: **Close / redirect** (superseded) — a score in the 70s doesn't
  mean the PR can be saved; check `git log -- <file>` on the base for an earlier fix.
- **PR 1443** (`addonStore.clear()` in `IPC_ADDONS_SAVE_ALL`; 2 lines, fork from 2023, base
  `master`, CI not run; scored 2026-11-06): 67/100, gates FAILED (base, Conflicts vs `develop`
  and `master`). Handler moved to `app/controllers/addon.controller.ts`; duplicate bug fixed by
  `672535aa` (#1561, on `master`). −15 Correctness (rescan saves one installation, so `clear()`
  wipes the others), −8 (`setInstallationAutoUpdate` also calls `saveAll`, contradicting the
  body), −5 Tests, −5 Scope. Lint/tests not run. **Close / redirect** (superseded).
- **PR 1433** (Windows ARM64 exe names; 26 lines, fork from 2023, base `develop`, CI not run;
  scored 2026-11-06): 76/100, gate FAILED (Conflicts: modify/delete of the renderer
  `warcraft.service.win.ts` vs `develop` and `master`). Windows half superseded by `213fcea2`
  (#1510, shipped v2.22.0, now in `app/services/warcraft/warcraft-platform.win.ts`); Linux half
  auto-merges into `warcraft-platform.linux.ts` but is unexplained. −8 Correctness (names added to
  `isWowApplication` only, `getClientType` returns None), −3 (ARM64 names on Linux/Wine), −5 Arch,
  −5 Tests, −2 Scope, −1 Hygiene. Lint/tests not run. **Close / redirect** (superseded); residual
  ideas (case-insensitive match, x64-emulated WowUp) go to a maintainer follow-up.
- **PR 1548** (package.json-only dependency bump from March, no lockfile; fork, CI not run; scored
  2026-11-06): 69/100, gates FAILED (Conflicts, Build, Tests). −15 Correctness: `package-lock.json`
  not updated, so `npm install` hits `ERESOLVE` and `bundle-publish.yml`'s `npm ci` fails. −8 Tests:
  zone.js 0.14.2 → 0.14.10 makes the `AddonInstallService` cleanup spec fail every run (spec races
  `completion.resolve()` before the `finally` cleanup; passes with 0.14.2). −5 Scope: a stale base
  would roll back `adm-zip` 0.6.1 and Electron 43 and re-add `win-ca`. Run on `develop` + PR with
  `develop`'s newer versions kept and the lockfile regenerated. Recommendation: **Request changes**
  (rebase, regenerate lockfile, fix spec) — or maintainer redoes the bump on `develop`.
  Lesson: for dependency PRs, test with the committed lockfile first (`npm ci`), then fresh.
