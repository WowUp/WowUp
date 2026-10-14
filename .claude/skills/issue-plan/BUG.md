# Bug Branch: Diagnose, Then Plan the Fix

Adapted from Matt Pocock's `diagnosing-bugs` skill. The core idea: **a fix plan without a
reproduction is a guess.** Spend most of the effort getting a signal that goes red on this bug.

## B1 — Build a feedback loop

Find one command that exercises the buggy code path and can fail on the reporter's exact
symptom. In this repo, roughly in order of preference:

1. **A failing spec** at the nearest seam — Mocha under `app/**/*.spec.ts` for main-process code
   (scan, download, controllers), Karma under `src/**/*.spec.ts` for renderer code (providers,
   components). Look at sibling specs for prior art (e.g. `curse-addon-provider.spec.ts`,
   `addon-scan.service.spec.ts`). Put throwaway repro specs in place but don't keep them unless
   they become the regression test.
2. **A provider/API call replayed in isolation** — for "addon not found / wrong version /
   wrong provider" issues, capture the real request/response the provider makes and replay it
   through the matching logic with the issue's addon (e.g. Auctionator, BagSync).
3. **A fixture addon folder** — for TOC/scan/matching issues, build a minimal `Interface/AddOns`
   tree with the reporter's TOC contents and run the scan against it.
4. **Driving the app** — `npm start` / `npm run ow:start` and the `run` skill, for UI-only
   symptoms (window position, context menus, progress text).
5. **Human-in-the-loop** — last resort, for things you can't drive (multi-monitor, macOS
   exFAT, `/tmp` noexec). Write exact steps for the user to run and what to report back.

Show the command and its (redacted) output. If you can't build a loop after a real attempt,
**say so, list what you tried, and ask** the user for access, a log, or a decision to plan
without one. Don't slide into theorising.

Platform/flavor matters: note which OS and flavor the reporter used, and whether your loop runs
on the same. A Linux-only or CF-only bug reproduced on Wago/Windows isn't reproduced.

## B2 — Reproduce and minimise

Confirm the loop shows the **reporter's** symptom, not a neighbouring one. Then cut inputs,
addons, steps one at a time until every remaining piece is needed for it to fail. A minimal
repro becomes the regression test.

If the thread says it's a regression ("worked in 2.20"), check whether `git log` / `git bisect`
between the release tags (`v2.20.0`..`v2.21.0`, etc.) can pin the commit — that often ends the
hunt immediately.

## B3 — Hypotheses

List **3–5 ranked, falsifiable hypotheses**: "If X is the cause, then changing Y makes the bug
disappear." **Show them to the user before testing** — they often know which one it is. Don't
block on the reply if they're away.

## B4 — Confirm the cause

Test hypotheses one variable at a time against the loop. Tag any temporary logging with a unique
prefix (e.g. `[DEBUG-1586]`) so cleanup is one grep. Remove all of it, and any throwaway specs,
before writing the plan.

Stop when one hypothesis is confirmed by the loop going green with a candidate change. Revert the
candidate change — it goes in the plan, not the tree.

## B5 — Write the plan (template)

```markdown
# Fix plan: <issue title> (#<n>)

**Issue:** <url> · **Type:** bug · **Flavor(s):** wago / ow / both · **Platform(s):** …

## Symptom
What the reporter sees, in their words, plus the exact error/output.

## Reproduction
The feedback-loop command and what red looks like. Note anything you couldn't reproduce.

## Root cause
The confirmed hypothesis and the evidence. Mention rejected hypotheses in one line each.
If it's a regression, the commit/PR that introduced it.

## Fix
What changes, described by behavior and the functions/types involved. Note whether it touches
a domain still in the renderer per UI_DECOUPLING_PLAN.md, and whether the fix stays there or
lands in the main-process controller.

## Regression test
The seam and what the test asserts. If no seam can exercise the real bug pattern, say so —
that's a finding, not a gap to paper over.

## Risks / blast radius
Other flavors, platforms, providers or user data (installed-addon records, settings) the change
could affect. Migration needs for existing users (e.g. addons already marked ignored/unknown).

## Acceptance criteria
- [ ] Reproduction command goes green
- [ ] Regression test passes; `npm run lint` and `npm test` pass
- [ ] …issue-specific, independently checkable items

## Out of scope
Related problems seen along the way that this fix should not take on.
```
