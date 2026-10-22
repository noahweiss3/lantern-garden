# Contributing to Lantern Garden

Lantern Garden is a review-stage, offline-first coding adventure. Good changes make a learner's next decision clearer, protect their work, or improve the reliability of the garden. Please keep proposals small enough to review and describe the problem before the solution.

A license for original code and artwork has not yet been selected. Discuss substantial contributions with the maintainer before submitting them. Do not add assets, fonts, or code without clear provenance and compatible reuse terms, or remove third-party notices.

## Choose a review checkpoint

`main` initially contains the overview and common documentation only. The complete 20-lesson implementation is on `feature/act-5-restoration-and-transfer`. Earlier acts are stacked draft review checkpoints, not independent releases. Start new work from the checkpoint it affects and target that branch in the pull request. See [the branch sequence](docs/implementation-checkpoints.md).

## Set up and check a change

Use Node.js 24 and npm, from the repository root:

```sh
git switch feature/act-5-restoration-and-transfer
npm ci
npm run dev
```

The development address is http://127.0.0.1:5173. Before a pull request:

```sh
npm test
npm run build
node scripts/package-review.mjs
npm run preview
```

The production preview is http://127.0.0.1:4173; the portable file is `artifacts/Lantern-Garden-Review.html`. Only the production build registers the offline worker. Generated `dist/`, `artifacts/`, browser profiles, dependency folders, and local journal backups do not belong in a source pull request.

`npm run test:e2e` is a separate, legacy opening-chapter browser fixture. It expects `/usr/bin/chromium`, starts its own server on port 4173, and is not a full-course acceptance test. Its browser playthrough has not yet passed for this review source. Do not treat the fixture's existence, a screenshot, or a phone preview as certification. Use the [manual acceptance checklist](docs/review-checklist.md) and report exactly what was observed.

## Find the right layer

- `src/engine.js`: bounded parser, interpreter, sensors, and reversible execution.
- `src/curriculum/act-1.js` through `act-5.js`: authored lesson data; `shared.js` contains data-only builders.
- `src/curriculum.js`: ordered lesson and activity exports.
- `src/main.js`: lesson gates, editor controls, feedback, journal, and offline status.
- `src/progress.js`: versioned browser-local progress, validation, migration, and backups.
- `src/world.js` and `src/batch-scenery.js`: the 3D scene, flat map, renderer state, and resource lifecycle.
- `index.html` and `src/style.css`: interface structure and presentation.
- `vite.config.js`: local static build and content-versioned offline cache.
- `tests/`: deterministic unit, reference-model, controller, renderer, packaging, and cache checks; browser fixtures are separate.

The [curriculum contract](docs/curriculum.md), [visual direction](docs/visual-direction.md), and [quality boundaries](docs/code-review.md) explain the intended behavior.

## Review expectations

- Preserve one primary goal, one program area, and one contextual feedback area. Keep secondary explanations optional.
- Keep the warm garden and Pip legible. Use rectangular controls, upright type, native local fonts, and non-color state cues. Do not introduce remote assets or analytics.
- Preserve learner drafts across errors, stop/reset, view changes, and recoverable storage failures. Never report a failed save or erase as successful.
- Keep language capabilities progressively gated and execution bounded. Do not evaluate learner text as JavaScript or Python.
- Accept alternate effect-correct programs rather than matching a reference solution. Lesson 19 must require either project, not both.
- Add a focused regression for behavior changes. State whether evidence is a simulation, real-browser observation, physical-device result, or learner observation.
- Do not include real learner names, private journals, credentials, personal screenshots, or browser-profile data in issues or pull requests.

Use the pull request template to describe scope, checks, and unverified behavior. Curriculum or assessment changes should explain the learning demand, not only the code path.
