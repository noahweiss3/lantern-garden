# Five review checkpoints

The implementation is organized as five stacked draft feature branches. Each checkpoint adds four lessons to the preceding act. They are review boundaries, not separate releases or evidence of browser, hardware, or learner acceptance.

`main` initially holds the professional project overview and shared documentation only. To run the complete 20-lesson course before the stack is merged, use `feature/act-5-restoration-and-transfer`. The default branch is not a playable checkout yet.

## 1. Focused foundations

**Branch:** `feature/act-1-focused-foundations`  
**Scope:** Lessons 1–4, 9 activities.

The original three activities remain Lesson 1. Add position versus facing, syntax versus logic repair, and plant care. Introduce the bounded language infrastructure, focused interface, lesson navigation, journal, and save migration needed by the later acts.

## 2. Purposeful repetition

**Branch:** `feature/act-2-purposeful-repetition`  
**Scope:** Lessons 1–8, 17 activities.

Add counted repetition tied to real plant needs, setup/body/departure placement, multi-action care rhythms, and fresh nursery rounds. The new lessons change the learning demand rather than adding more equivalent routes.

## 3. Sensors and choices

**Branch:** `feature/act-3-sensors-and-choices`  
**Scope:** Lessons 1–12, 25 activities.

Add initial-state sensor observations, taken and skipped conditional bodies, alternatives, and one learner-authored decision checked against contrasting worlds. Lesson 12 awards the transfer activity only when the exact current program succeeds in both worlds.

## 4. Visible routines

**Branch:** `feature/act-4-visible-routines`  
**Scope:** Lessons 1–16, 33 activities.

Add visible no-argument definitions and calls, familiar reusable jobs, shared-body repair, and conditional helpers. Keep the whole helper readable; supplied routines are not invisible magic.

## 5. Restoration and transfer

**Branch:** `feature/act-5-restoration-and-transfer`  
**Scope:** Lessons 1–20, 41 available activities; 40 required.

Add repeated sensor checks, zero-iteration entry, termination repair, an either-or restoration project, and a final fresh variation. Completing either Lesson 19 project permits Lesson 20; completing both is optional. This branch contains the full-course regression suite.

## Shared review gates

- Deterministic bounded execution and complete reversible state.
- Meaningful progressive practice with alternate effect-correct programs accepted.
- One primary goal, one program, and one contextual feedback area; secondary material is optional.
- Labeled controls, a flat fallback, and non-color state cues.
- Browser-local saves, migration, backups, and honest recovery messages.
- Automated checks with the exact source revision and evidence type recorded.

The normal app unlocks lessons after required activities and the preceding explanatory check. The portable review file enables direct lesson selection for inspection. Neither mode establishes learning mastery.

Before merging or describing a checkpoint as release-ready, complete the relevant [manual acceptance checks](review-checklist.md). The [quality boundaries](code-review.md) separate the automated baseline from pending browser, offline-install, device, and learner validation. Never copy a final-branch test result onto an earlier checkpoint.
