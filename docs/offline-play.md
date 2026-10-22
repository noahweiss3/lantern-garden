# Play offline and keep your journal

Lantern Garden has two review paths. Both use the same authored activities; only the normal app guides progression through lesson checkpoints. The portable review lets a reviewer jump directly to implemented lessons.

## Portable review: one downloaded file

1. Obtain a generated `Lantern-Garden-Review.html` file from a trusted project delivery, or generate it with the developer steps below. A bare source checkout does not contain this generated file.
2. Save it to the device, then open it directly in a Chromium browser. An email, chat, or file-preview pane may block active HTML.
3. Use **Lessons** to select a review activity. The file contains the code, styles, and game assets, so it does not need a development server or network connection to load them.
4. Keep the file at a stable location and export your journal. Local-file storage behavior varies by browser; do not rely on it as the only copy of your work.

This is a self-contained review file, not an installable PWA. No Node.js installation is needed to open a file that has already been generated. Actual browser behavior is still part of acceptance testing.

## Normal app: prepare the offline cache first

The normal app is a static production build served over HTTPS or localhost. Its first complete load needs access to that server.

1. Open the production app in the browser profile you intend to keep using.
2. Open **Journal & settings** and wait for **Ready for offline play**. If setup fails, stay online and reload; do not assume the files were cached.
3. If **Install offline** appears, follow the browser's install prompt. The button is browser-dependent; an installed window is optional for testing cached play in a browser.
4. Disconnect the network and reload the same address. After that succeeds, close and reopen the same browser profile while offline and check again.
5. Confirm a saved program, a lesson checkpoint, the flat map, and your journal still behave correctly. Export a backup.

The built-in status reports worker/cache readiness. It is not proof that offline reload, browser restart, or installation succeeded on a particular device. Those checks, including the target Chromebook, are still pending. Installing or previewing on a phone does not certify Chromebook keyboard, touch, folio, battery, or performance behavior.

Do not open `dist/index.html` as a local file to test the PWA. Serve the build instead. The development server does not install the offline worker.

## Build either path locally

On the complete review branch, use Node.js 24 and npm:

```sh
git switch feature/act-5-restoration-and-transfer
npm ci
npm test
npm run build
npm run preview
```

Open http://127.0.0.1:4173 for the production/offline checks. Keep using that address and browser profile when checking reload and restart. The preview server is local-only, not a public or phone-accessible deployment.

To generate the portable review after building:

```sh
node scripts/package-review.mjs
```

Open the resulting `artifacts/Lantern-Garden-Review.html` directly in the browser. Rebuild and repackage whenever source changes. The overview-only `main` branch cannot run these commands until implementation is merged; use the full-course review branch in the meantime.

## Back up or move progress

- **Export journal** downloads `lantern-garden-field-journal.json`. Keep a copy somewhere you control.
- **Import journal** validates a Lantern Garden backup under 1 MB and asks before replacing the current profile's progress. Export the current journal first if you want to keep both.
- Progress does not sync between devices, browser profiles, the hosted app, or the portable file. Use export/import when moving between them.
- Clearing browser data, private browsing, school storage policies, device loss, or a changed local-file location may remove or separate saved progress.
- If saving is unavailable, play can continue, but export before leaving. There is no server recovery.

The normal app opens lessons after the preceding activities and explanatory check. There are 41 available activities and 40 required: complete either Lesson 19 project to continue to Lesson 20. Clues and retries do not incur penalties.
