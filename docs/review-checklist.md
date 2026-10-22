# Review the garden

Use this checklist for direct acceptance observations, not as a list of checks already passed. Record the branch/commit, build mode, browser/version, operating system, device, viewport, input method, and result. Use synthetic journals when sharing evidence.

For a full review, select `feature/act-5-restoration-and-transfer` and follow the [setup instructions](../README.md#run-locally). The portable review file permits lesson jumping; test normal progression separately in the production app.

## First visit

- [ ] The garden, Pip, the walkable tiles, start direction, and destination are distinguishable without relying only on color.
- [ ] One primary goal, the program, contextual feedback, and actions remain easy to find. Optional notes and settings do not crowd them.
- [ ] In Lesson 1, predict the supplied route, step through its turn, repair the next route, and write the fresh route without copying a solution.
- [ ] Wrong predictions, syntax errors, blocked steps, clues, retry, Stop, Undo, and Back to dock preserve usable work and give specific feedback.
- [ ] Opening Field notes, Journal & settings, checks, and Lessons keeps focus sensible; closing returns it to the initiating control.

## Across the five acts

- [ ] Lessons 2–4 distinguish tile from facing, syntax from logic, and movement from plant care.
- [ ] Lessons 5–8 make repeat count and body boundaries visible, including a multi-action body and setup outside it.
- [ ] Lesson 9 asks for initial sensor observations before Run/Step. Lessons 10–11 visibly distinguish taken, skipped, and alternative bodies.
- [ ] Lesson 12 carries the current card into the contrasting world; a board-specific plan cannot complete the two-world requirement.
- [ ] Lessons 13–16 show routine bodies, distinguish definition from call, and let one shared repair improve multiple uses.
- [ ] Lessons 17–18 show zero iterations and safely pause a loop whose body never changes its condition; a repair can finish it.
- [ ] Either Lesson 19 project independently unlocks Lesson 20 after its check. The other project stays optional and replayable.
- [ ] Lesson 20 supports restoration and the fresh variation; the optional Python bridge is closed by default and states that this language is not Python.
- [ ] Normal progression, revisits, checks, save/reload, and the lesson map agree. Direct selection in the portable review is identified as review behavior.

## Layout, inputs, and accessibility

- [ ] Inspect 1024×768 landscape, 768×1024 portrait, 768×600 short landscape, and a narrow phone viewport. Nothing essential is clipped, hidden behind actions, or unreachable by scrolling.
- [ ] Compare 3D and Flat view during ordinary play and an active run. Pose, program, care state, active line, Undo, and feedback remain consistent.
- [ ] Navigate the editor, tile map, lesson dialog, checks, journal, and all actions using the keyboard alone. Check Tab, arrow keys, Enter, Escape, visible focus, and no focus trap behind a closed overlay.
- [ ] Check accessible names, reading order, live feedback, errors, and the flat map with a real screen reader. Code/DOM labels alone do not establish this result.
- [ ] Check touch targets, on-screen keyboard behavior, and reduced motion, including an operating-system motion preference.
- [ ] Test the intended Chromebook and actual keyboard, touch, or folio accessories. A phone preview is supplementary, not certification.

## Offline and recovery

- [ ] Use a production build over HTTPS or localhost, not the development server. Wait for **Ready for offline play**.
- [ ] Install if supported; test network-disabled reload, query navigation, and reopening the same browser profile while offline.
- [ ] Continue a saved lesson and program offline. Test flat/3D changes, journal export, and import of a synthetic backup.
- [ ] Import asks before replacing current progress; canceling preserves it. Invalid/oversized files fail without losing work.
- [ ] Storage denial or preparation failure produces a truthful warning, not a false success. Test erase only with disposable progress.
- [ ] Open the generated portable file directly and offline. Distinguish self-contained local-file behavior from PWA installation.

See [offline play and backups](offline-play.md) for the detailed procedure.

## Learner and release observations

- [ ] Ask a first-time learner what each instruction changes, where they expected Pip to go, and why a repair works. Do not count a completed level alone as understanding.
- [ ] Record confusing wording, reading load, clue usefulness, actual visit length, and whether the story feels inviting. Proposed 10–15-minute opening and 15–25-minute later visits are hypotheses, not deadlines.
- [ ] Check sustained device use for responsiveness, heat, and battery impact; scene counts and automated tests are not measurements of these.
- [ ] Separate observed results from impressions and remaining questions. Do not call the course Python instruction, proven learning, or hardware-certified.
- [ ] Record actual visual QA before capturing demo videos or promotional screenshots. Do not stage a mock application image as evidence of gameplay.

There are no learner accounts or telemetry. Keep shared feedback free of names, private journals, personal screenshots, and other identifying details. See [quality boundaries](code-review.md) for the current automated baseline and pending acceptance work.
