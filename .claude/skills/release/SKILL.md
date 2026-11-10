---
name: release
description: "Cut a stable WowUp release: drop the beta tag, cut release/X.Y.Z from develop, build both flavors, fill the draft releases, publish and promote the app bundles, then merge to master and back into develop."
---

# Cut a Release

Turns the current beta on `develop` (e.g. `2.25.5-beta.4`) into a stable release (`2.25.5`). Work
through the steps in order and keep the user posted on which step you're on.

**Wait for the user's go-ahead before every step marked ⏸.** Those steps publish, push, merge or
change what users download. An earlier "yes" covers only the step it answered. Running a build
workflow (step 5) is fine once the user has asked for the release.

Do the work against `origin`. Don't stage, commit or discard the user's unrelated local edits; when
committing, add only the files named in the step.

## Step 1 — Find the version and cut the branch

```bash
git fetch origin
git show origin/develop:wowup-electron/package.json | grep '"version"'
```

The release version is that version with the pre-release suffix removed (`2.25.5-beta.4` → `2.25.5`).
Make sure `release/X.Y.Z` doesn't already exist on the remote, then make sure `origin/master` has
nothing missing from `origin/develop` (`git log --oneline origin/develop..origin/master`). If it
does, tell the user before continuing.

```bash
git switch -c release/X.Y.Z origin/develop --no-track
```

Uncommitted local edits come along with the switch; leave them alone.

## Step 2 — Set the version

The version is in four files: `package.json` and `package-lock.json` in both `wowup-electron/` and
`wowup-shell/`. Change them with npm. `--ignore-scripts` is required: `wowup-electron` has a version
hook that runs `conventional-changelog`, which isn't installed and fails the command partway through.

```bash
(cd wowup-electron && npm version X.Y.Z --no-git-tag-version --ignore-scripts)
(cd wowup-shell && npm version X.Y.Z --no-git-tag-version --ignore-scripts)
```

Check `git diff` shows only the four `version` changes (two per lockfile).

## Step 3 — Check the patch notes

The `X.Y.Z` entry at the top of `CHANGELOGS` in
`wowup-electron/src/app/services/wowup/patch-notes.service.ts` was written during the betas. Find the
last beta's version commit (`git log --oneline --grep="Set the version to X.Y.Z-beta" origin/develop`)
and list what merged after it:

```bash
git log --oneline --first-parent <lastBetaCommit>..origin/develop
```

For each user-facing PR that isn't in the entry, propose a line in the entry's voice and ask the
user before adding it. If there's no `X.Y.Z` entry at all, use the `patch-notes` skill.

## Step 4 — ⏸ Commit, push and open the PR

Show the diff, and on the user's go-ahead commit only the version files and `patch-notes.service.ts`:

```
Set the version to X.Y.Z and update patch notes
```

Push, then open the PR into **`master`** (release branches are the one exception to targeting
`develop`):

```bash
git push -u origin release/X.Y.Z
gh pr create --base master --head release/X.Y.Z --title "Release X.Y.Z" --body "..."
```

The body lists the version change and any patch-notes additions, and notes that `master` gets merged
back into `develop` afterwards. Then call `get_status` to bind the PR in the app.

## Step 5 — Build both flavors

Both workflows take no inputs:

```bash
gh workflow run "Build WowUp Electron All" --ref release/X.Y.Z
gh workflow run "Build WowUp Electron All CF" --ref release/X.Y.Z
```

They take a while; watch them in the background with `gh run watch <id> --exit-status`. Each one
creates a **draft** `vX.Y.Z` release: the wago build in `WowUp/WowUp` and the CF build in
`WowUp/WowUp.CF`.

## Step 6 — Fill in the draft releases

Give both drafts the same description: the `X.Y.Z` patch-notes entry converted to Markdown, keeping
its `## Features` / `## Changes` / `## Fixes` sections (drop any that are empty).

```bash
gh release edit vX.Y.Z --notes-file notes.md
gh release edit vX.Y.Z --repo WowUp/WowUp.CF --notes-file notes.md
```

Draft URLs are `.../releases/tag/untagged-…` until published. Write `notes.md` in the scratchpad.

## Step 7 — The user publishes the binaries

Publishing the GitHub releases is the user's step. Ask them to publish both drafts and mark them
latest, and wait until they say it's done. Binaries go out **before** the bundles: the installer
already has the app inside, so shells that update from the release won't download the bundle a
second time, and a bad draft can still be deleted before any bundle reaches users.

## Step 8 — ⏸ Publish the bundles to stable

One run per flavor, from the release branch. They queue behind each other (they write the same
Pages files), so it's fine to start both at once:

```bash
gh workflow run bundle-publish.yml --ref release/X.Y.Z -f flavor=wago -f channel=stable -f rollout=100 -f repo=WowUp/wowup-bundles
gh workflow run bundle-publish.yml --ref release/X.Y.Z -f flavor=ow -f channel=stable -f rollout=100 -f repo=WowUp/wowup-bundles
```

A version can be published only once; if the workflow says `X.Y.Z` is already published, use
Promote bundle instead. After both runs succeed, check the manifests:

```bash
for p in wago/stable ow/stable; do echo "$p: $(gh api repos/WowUp/wowup-bundles/contents/$p/shell-api-1.json --jq .content | base64 -d | grep '"version"')"; done
```

## Step 9 — ⏸ Point beta at the release

Shells check only their own channel, so beta users stay on the last beta until beta moves:

```bash
gh workflow run bundle-promote.yml --ref release/X.Y.Z -f flavor=wago -f version=X.Y.Z -f channel=beta -f rollout=100 -f repo=WowUp/wowup-bundles
gh workflow run bundle-promote.yml --ref release/X.Y.Z -f flavor=ow -f version=X.Y.Z -f channel=beta -f rollout=100 -f repo=WowUp/wowup-bundles
```

Check `wago/beta` and `ow/beta` the same way as step 8.

## Step 10 — ⏸ Merge to master, then back into develop

```bash
gh pr merge <PR> --merge
```

Do the back-merge in a temporary worktree in the scratchpad so the user's checkout isn't touched:

```bash
git fetch origin
git worktree add --detach <scratchpad>/backmerge origin/develop
cd <scratchpad>/backmerge
git merge --no-ff origin/master -m "Merge master into develop after the X.Y.Z release"
git push origin HEAD:develop
cd - && git worktree remove <scratchpad>/backmerge
```

Confirm `git rev-list --count origin/develop..origin/master` prints `0`. If the merge conflicts, stop
and show the user the conflicts.

## Wrap up

Report the PR, both releases, the four channel versions and the back-merge commit. The local
`release/X.Y.Z` branch can be deleted; offer to do it, but only if no uncommitted edits would be lost.
