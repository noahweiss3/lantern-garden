<p align="center">
  <img src="docs/assets/wordmark.svg" alt="Lantern Garden. A quiet coding adventure, with Pip the garden robot." width="960">
</p>

# Lantern Garden

Restore a storm-damaged conservatory, one small program at a time.

Guide Pip through a warm 3D garden: read a plan, predict what it will do, test it, and change it. Twenty authored lessons introduce sequencing, repetition, decisions, reusable routines, and sensor-controlled loops. There is no timer, account, or score to chase.

**Act 1 review checkpoint · Lessons 1–4 · 9 activities**  
This branch contains the first 4 lessons. The complete course is available on the final stacked review branch.

## Start here

[Play Lantern Garden](https://lantern-garden-pink.vercel.app) in the browser. This link opens the complete 20-lesson review, regardless of the source checkpoint selected below.

**Want to play or review without developer tools?** Use a provided `Lantern-Garden-Review.html` file. Download it, then open it directly in a Chromium browser. It contains the game, artwork, and styles in one file, with direct lesson selection for review. An attachment viewer may not run active HTML. This portable file is not an installable app. See [playing offline and keeping progress](docs/offline-play.md).

**Want the installable version?** Build the app and serve `dist/` over HTTPS or localhost. In **Journal & settings**, wait for **Ready for offline play** before disconnecting. Installation is offered when the browser supports it. Real installation, offline browser restart, and Chromebook behavior still need acceptance testing.

**Looking at `main`?** It initially contains the project overview and shared documentation, not the playable implementation. The full 20-lesson review lives on `feature/act-5-restoration-and-transfer` until the stacked draft branches are reviewed and merged. The [five review checkpoints](docs/implementation-checkpoints.md) explain the sequence. [Play the hosted review](https://lantern-garden-pink.vercel.app) to inspect the complete 20-lesson test build. A flat map is available when 3D graphics cannot start.

## Run locally

Use **Node.js 24** and npm. For a fresh developer checkout, clone the project and select this checkpoint:

```sh
git clone https://github.com/noahweiss3/lantern-garden.git
cd lantern-garden
git switch feature/act-1-focused-foundations
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. If the branch is only on the remote, fetch it first with `git fetch origin`. The development server does not prepare offline files.

For a production preview and a portable review file:

```sh
npm test
npm run build
npm run preview
```

Open **http://127.0.0.1:4173**. Stop the preview with Ctrl+C, then run:

```sh
node scripts/package-review.mjs
```

This writes `artifacts/Lantern-Garden-Review.html`. Build again before repackaging changes. npm downloads dependencies during setup; the built game needs no CDN, remote fonts, API keys, or backend. See [CONTRIBUTING.md](CONTRIBUTING.md) for the source map and review workflow.

## A small language, a complete journey

| Act | Lessons | What changes |
| --- | --- | --- |
| Focused foundations | 1–4 | Read, repair, and write sequences; track facing; care for plants. |
| Purposeful repetition | 5–8 | Count real care jobs and repeat multi-action rhythms. |
| Sensors and choices | 9–12 | Read sensors and test one decision in contrasting gardens. |
| Visible routines | 13–16 | Name familiar jobs, reuse them, and repair shared behavior. |
| Restoration and transfer | 17–20 | Reason about termination, choose a project, and adapt a final plan. |

The garden language is deliberately limited, **not Python**. Commands unlock gradually, and block bodies use two-space indentation. Variables, parameters, return values, collections, nested-loop tasks, recursion, and classes are outside this course. The final optional note points toward an explicit Python bridge.

Programs run through a bounded interpreter, never host-language evaluation. Step, Run, Undo, a flat map, reduced motion, and progressive clues support experimentation. Journal progress stays in the current browser profile. Export a backup before changing devices or clearing browser data; there is no cloud recovery.

Read the [curriculum](docs/curriculum.md) and [evidence-informed learning rationale](docs/learning-rationale.md) for the learning goals and their limits.

## What is verified

This checkpoint is checked separately from the final course. Run its automated suite and production build on the source under review; the complete-course test count must not be applied to this earlier branch. These checks cover the interpreter, authored solutions, progression, save recovery, renderer state/lifecycle with a simulated GPU, and offline-cache simulations.

Separately, targeted real-browser checks passed Lesson 1 and key gates in Lessons 12, 19, and 20 using the flat fallback. These checks do not establish 3D rendering, real offline installation/restart, screen-reader compatibility, physical Chromebook performance, or learning outcomes. Phone-browser review is not device certification. [Quality boundaries](docs/code-review.md) and the [acceptance checklist](docs/review-checklist.md) keep the remaining work explicit. Demo videos will follow actual visual QA, not stand in for it.

Contributions should preserve the focused interface and honest evidence boundaries. See [contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md).

**Licensing:** a license for the original project code and artwork has not yet been selected; this repository does not currently include a license grant for them. Dependency notices are retained in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).
