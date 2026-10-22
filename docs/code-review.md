# Quality boundaries

Lantern Garden has a complete authored 20-lesson implementation for review. It is not yet a learner-validated or hardware-certified release. This document separates source-level evidence from acceptance work that still requires a real browser, device, or learner.

## Automated evidence

The current full-course review passed **153 local automated tests** and a production build on Linux with Node.js 24. Test counts may grow; use the output from the exact branch and commit under review rather than transferring a result to another revision. No macOS, Windows, or Chromebook development-toolchain validation is implied.

The suite covers:

- Bounded parsing and execution, progressive syntax gates, rejection of unknown constructs and recursion, control-flow limits, and complete Undo.
- All 41 authored reference solutions, real goal/care/facing requirements, immutable lesson data, and independent reference-model comparisons.
- Sequential lesson progression, initial sensor observations, explanatory checks, clues, retained checkpoint passes, and either Lesson 19 project.
- Lesson 12's exact-current-source gate across both contrasting worlds, including rejection of board-specific plans.
- Versioned saves, migration, storage denial, bounded backup import/export, and honest failure/recovery behavior.
- Actual Three.js scene construction and state/lifecycle behavior with a simulated DOM/GPU, including flat-map state, care markers, view changes, and resource disposal.
- Offline-cache simulations, failed-install handling, cache-version changes, and self-contained portable packaging.

A production build confirms bundling, not successful rendering or installation. Simulated browser interfaces are not real-browser acceptance. Scene object counts are not measured frame rates or GPU draw calls. Dependency source and the full lockfile have not received an independent security audit.

## Targeted real-browser observations

On 22 October 2026, the full-course hosted review was exercised in Chromium on Linux at an observed **1180 × 757** viewport. The served eight-file build matched the reviewed local build byte-for-byte. This was targeted functional and visual acceptance, not an exhaustive run of every activity.

- WebGL could not start in this browser. The honest warning and labelled flat-map fallback rendered and remained usable, with no observed horizontal overflow at that viewport.
- Lesson 1 passed prediction gating, turn-in-place, Undo, wrong-route blocking, keyboard repair, malformed-program rejection, and a fresh route.
- Rebuilding the view during a live run preserved the program, current position, run state, and Undo history. Retrying unavailable 3D kept the flat fallback usable; a successful 3D/Flat switch was **not** observed.
- Recap feedback appeared below both answer buttons and before the save action. Incorrect answers blocked continuation; a correct answer enabled it. Modal keyboard wrapping and Escape worked.
- A real journal export contained the expected draft/checkpoint data; reload retained the draft and progress. Import and a full browser restart were not checked.
- Lesson 12 carried the exact current program into a contrasting world and rejected a one-board shortcut despite reaching that board's light. The shared decision succeeded in both worlds.
- Lesson 19 presented two distinct projects. Completing one selected deep-pot project and its checkpoint opened Lesson 20; partial watering, Undo and Reset behaved correctly. The other project was not fully played through.
- Lesson 20's first restoration succeeded; its fresh variation exposed insufficient one-dose care. The focused `if` to `while` repair restored both pots and reached the final checkpoint and optional Python bridge.
- The interface reported **Ready for offline play**. This establishes a preparation status observation, not successful network-disabled use.

The [hosted review](https://lantern-garden-pink.vercel.app) is a public test build, not a certified release. The game stores progress in the current browser profile; viewing the link does not grant access to another player's journal.

## Acceptance still pending

Use the [review checklist](review-checklist.md) to record direct observations of:

- Real 3D rendering and a successful 3D/Flat swap; additional layouts, touch, reduced-motion acceptance, and screen-reader behavior.
- Exhaustive full-course browser flow, including the unplayed alternative project and import/restart recovery beyond the targeted checks above.
- Production offline preparation, installation where supported, network-disabled reload, and reopening a browser profile while offline.
- Landscape, portrait, narrow, and short viewports, followed by the actual target Chromebook and input accessories.
- Physical-device performance, sustained use, battery impact, and beginner clarity, pacing, explanation, and retention.

The separate `npm run test:e2e` fixture covers an older opening-chapter browser flow, requires system Chromium, and has not yet passed for this review source. It is not a full 20-lesson browser suite. A phone-browser review cannot replace physical Chromebook testing. Screenshots document observed states only and are not substitutes for these acceptance checks.

## Learning and privacy claims

Completion, retries, and zero-clue successes are narrow practice evidence, not proof of lasting mastery. The saved `evidence.independent` flag means zero clue clicks, including for supplied programs; it does not mean unaided authorship. Effect-correct alternatives may use inline actions instead of the intended loop or routine. The final variation is authored near transfer, not a randomized or delayed assessment.

The teaching language is not Python. The [learning rationale](learning-rationale.md) distinguishes published findings from this project's design judgments. Proposed lesson durations and learning outcomes need direct learner testing.

There are no learner accounts, telemetry, or journal-upload backend in the game. Progress is local to a browser profile; backup and recovery limits are documented in [offline play](offline-play.md) and [security](../SECURITY.md).
