---
name: patch-notes
description: "Generate an in-app patch notes entry for the current wowup-electron version, if one isn't already present in CHANGELOGS."
---

# Generate Patch Notes

WowUp's in-app "What's New" dialog is driven by the `CHANGELOGS` array at the top of
[`wowup-electron/src/app/services/wowup/patch-notes.service.ts`](../../../wowup-electron/src/app/services/wowup/patch-notes.service.ts).
Each entry is `{ Version: string, html: string }`, newest first. Do **not** touch
`wowup-electron/src/assets/changelog.json` — that's a legacy file for pre-2.1.0 releases and is no longer
extended.

## Step 1 — Determine the target version

Read `version` from `wowup-electron/package.json`. Strip any pre-release/build suffix
(`-beta.1`, `-alpha.2`, etc.) — every existing `CHANGELOGS` entry uses a bare `X.Y.Z`, never a
pre-release tag.

## Step 2 — Check if it already exists

Search the `CHANGELOGS` array for an entry whose `Version` matches. If found, **stop** — tell the
user the entry already exists (quote it) and do not modify the file.

## Step 3 — Find the source material

The current top entry of `CHANGELOGS` is the previous released version. Find its git tag with
`git tag --list "v<prevVersion>*" --sort=-v:refname` (tags follow `v2.22.1`, or
`v2.22.1-beta.N` if no stable tag was ever cut). Use the most relevant tag as the base and diff
to `HEAD`:

```
git log --oneline <baseTag>..HEAD -- wowup-electron/src wowup-electron/app
```

If no matching tag exists at all, ask the user for the right base ref instead of guessing.

If that tag *does* exist but the range is empty (`HEAD` is the tagged commit, i.e. everything
interesting is still uncommitted — this happens mid-release), fall back to
`git diff <baseTag> -- wowup-electron/src wowup-electron/app` and `git status` instead of
stopping. Don't ask the user to commit first; just work from the working tree.

## Step 4 — Draft the entry

Read the actual commits/diffs (not just messages) for anything non-obvious. Group into
whichever of these sections apply — skip empty ones, keep existing entries' ordering:

1. `Features` (new user-facing capability)
2. `Changes` (behavior/UX tweaks, non-breaking)
3. `Fixes` (bug fixes)

Write each bullet as a short, user-facing sentence (not a commit message) — no ticket numbers,
no internal file paths, no "refactor"/"chore" noise. Skip commits/diff hunks that are purely
internal (lint, tests, CI, dependency bumps, config/build tooling, the ongoing UI-decoupling
migration) unless they fix a user-visible bug. Match the plain style of the two most recent
entries (`2.22.1`, `2.22.0`) — no inline `style=` attributes, just:

```html
<h4>Features</h4>
<ul>
<li>...</li>
</ul>
<h4>Fixes</h4>
<ul>
<li>...</li>
</ul>
```

**If nothing user-facing survives that filter** (everything found is internal refactor, tooling,
or config), don't stop and ask what to write. Fall back to a minimal default entry instead —
this mirrors how past releases with a quiet cycle were actually written (see `2.22.1`'s own
"Various bug fixes"):

```html
<h4>Fixes</h4>
<ul>
<li>Various bug fixes and improvements</li>
</ul>
```

Flag clearly in the hand-off (Step 6) that the default was used and why, so it's obvious this is
a placeholder rather than a researched entry.

## Step 5 — Insert

Add the new `{ Version, html }` object as the **first** element of the `CHANGELOGS` array
(right after `const CHANGELOGS: ChangeLog[] = [`), preserving the descending-version order of
every entry after it.

## Step 6 — Hand off

Show the user the diff. This is a first draft of customer-facing release copy — tell them to
proofread wording/ordering before it ships, don't present it as final.
