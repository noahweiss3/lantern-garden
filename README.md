<p align="center">
  <img src="docs/assets/wordmark.svg" alt="Lantern Garden. A quiet coding adventure, with Pip the garden robot." width="960">
</p>

# Lantern Garden

Restore a storm-damaged conservatory, one small program at a time.

Guide Pip through a warm 3D garden: read a plan, predict what it will do, test it, and change it. Twenty authored lessons introduce sequencing, repetition, decisions, reusable routines, and sensor-controlled loops. There is no timer, account, or score to chase.

**Review-stage project · 5 acts · 41 available activities · 40 required**  
Lesson 19 offers two restoration projects; choose either one to continue. The garden language is deliberately small and is **not Python**.

## Find the playable review

[Play Lantern Garden](https://lantern-garden-pink.vercel.app). This is a public review build, not a certified release.

This `main` branch initially contains the project overview and shared documentation only. It is not a runnable game checkout yet. The implementation is organized as [five stacked draft review branches](docs/implementation-checkpoints.md), each adding four lessons. The complete 20-lesson source lives on:

**`feature/act-5-restoration-and-transfer`**

For a fresh developer checkout, clone the project and select that branch before installing dependencies:

```sh
git clone https://github.com/noahweiss3/lantern-garden.git
cd lantern-garden
git switch feature/act-5-restoration-and-transfer
npm ci
npm run dev
```

Use **Node.js 24** and npm. Open **http://127.0.0.1:5173**. The review-branch README has production preview, tests, and portable-file instructions. Development setup has been validated on Linux with Node.js 24; other toolchains are not certified.

## Play and keep your progress

A generated `Lantern-Garden-Review.html` can be downloaded and opened directly in a Chromium browser without developer tools. It bundles game code, styles, and artwork and permits direct lesson selection for review. It is not an installable app, and the generated file is not included in this overview-only branch.

The normal production app uses an offline cache over HTTPS or localhost. Wait for **Ready for offline play** in **Journal & settings** before disconnecting. Export a journal before changing devices or clearing browser data; progress is browser-profile-local, with no cloud recovery. See [offline play and backups](docs/offline-play.md). [Play the hosted review](https://lantern-garden-pink.vercel.app) to inspect the complete 20-lesson test build. A flat map is available when 3D graphics cannot start.

## Built to be inspected

The course moves from sequences and plant care through counted repetition, sensors and decisions, visible routines, and a final restoration with a fresh variation. It uses a bounded interpreter rather than evaluating learner text as JavaScript or Python. Step, Undo, progressive clues, a flat map, and reduced motion support experimentation without penalties.

Read the [curriculum](docs/curriculum.md), [learning rationale](docs/learning-rationale.md), and [visual direction](docs/visual-direction.md). Published findings are separated from proposed pacing and learning outcomes.

The current full-course review passed **153 local automated tests** and a production build on Linux with Node.js 24. These are source/model/controller/renderer-lifecycle/cache checks, not real-browser, hardware, or learner validation. Targeted real-browser checks passed the opening chapter and key later-lesson gates in the flat fallback. Real 3D rendering, offline installation/restart, screen-reader behavior, Chromebook use, and learning outcomes remain pending. Phone-browser review is not hardware certification. See [quality boundaries](docs/code-review.md) and the [acceptance checklist](docs/review-checklist.md). Demo videos will follow actual visual QA.

For proposals and setup details, see [CONTRIBUTING.md](CONTRIBUTING.md). Report sensitive issues as described in [SECURITY.md](SECURITY.md), without posting learner data or private journals.

**Licensing:** a license for original code and artwork has not yet been selected; this repository does not currently include a license grant for them. Dependency notices remain in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).
