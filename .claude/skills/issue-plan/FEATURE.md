# Feature Branch: Interview, Then Plan the Build

Adapted from Matt Pocock's `grilling` and `to-spec` skills. The core idea: **settle the
decisions with the user before writing the plan**, and look up facts yourself instead of asking.

## F1 — Is it in scope at all?

Before designing anything, check whether a maintainer already pushed back in the thread (e.g.
"we have no control over CF search", "PATs aren't meant to be shared", "downgrades won't
happen"). If so, put that to the user first: plan anyway, plan a narrower version, or stop.

Also check for constraints outside WowUp's control — provider APIs (CurseForge, Wago,
WowInterface, GitHub), Blizzard client layout, Electron/Overwolf packaging. A feature that
needs an API the provider doesn't expose is a finding, not a plan.

## F2 — Interview in rounds

Map the feature as a tree of decisions. Each round, ask every question whose prerequisites are
already settled — numbered, with your recommended answer, worded so "yes" accepts it:

```
❓ **Q1 — <title>**: <question, with the options>

➡️ <recommended answer>
```

Typical WowUp decisions: which flavor(s) get it (wago / ow / both); which providers it applies
to; where the UI lives (My Addons, Get Addons, Options, context menu); whether it's a new
setting and its default; whether it lives in a main-process controller or the renderer (new
domain logic should go in `app/controllers/` + a thin `src/app/services/api/` wrapper per the
decoupling plan); persisted data and migration for existing users.

Facts are your job: if a question needs a fact from the code, the provider API or the thread,
go find it (use `Explore` for broad searches) rather than asking. Decisions are the user's.

Recompute the next round from the answers. Stop when no open decisions remain, and confirm with
the user that you share the same picture before writing the plan. If the user is away or says
"just plan it", take your recommended answers and list them as assumptions in the plan.

## F3 — Pick the test seams

Name where the feature will be tested — prefer existing seams and as few as possible: Mocha
specs for controllers/main-process services, Karma specs for renderer services/components. Check
the seams with the user.

## F4 — Write the plan (template)

```markdown
# Implementation plan: <issue title> (#<n>)

**Issue:** <url> · **Type:** feature · **Flavor(s):** wago / ow / both

## Problem
What the user can't do today, from their perspective.

## Solution
What they'll be able to do, from their perspective.

## User stories
1. As a <WowUp user / addon author / maintainer>, I want <capability>, so that <benefit>
…(cover the main path, edge cases, and failure cases)

## Decisions
Each settled decision from the interview, one line each, plus assumptions taken without an
answer (marked as such).

## Implementation
Modules/controllers/services to add or change and their interfaces (types, IPC channels,
settings keys), described by behavior. Where it sits relative to the UI decoupling plan.
Any new user-facing strings: add keys to every locale file in `src/assets/i18n/`
(English placeholder is fine), not just `en.json`.

## Steps
An ordered list of small, independently reviewable steps — each one leaves the app working.

## Testing
Seams and what each test asserts (external behavior, not internals). Prior-art specs to copy.

## Acceptance criteria
- [ ] …specific, independently checkable items
- [ ] `npm run lint` and `npm test` pass

## Out of scope
Adjacent ideas from the thread that this plan deliberately leaves out.
```
