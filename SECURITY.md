# Security

Lantern Garden is a review-stage browser application, not a production-certified service. There is no published security-support window or completed independent dependency audit. Use the current review source and do not enter passwords, API keys, or personal information into the program editor.

## Report a vulnerability privately

Do not post exploit details, credentials, personal data, or real journal backups in a public issue. If the repository offers **Security → Report a vulnerability**, use that private reporting flow. Otherwise contact the maintainer through a verified private contact channel listed on their profile before sharing sensitive details. No separate security inbox or response-time commitment is currently published.

Include the affected branch or commit, browser and operating system, a minimal reproduction with synthetic data, likely impact, and any safe workaround. An ordinary usability bug can use the public bug template after removing private information.

## Application boundaries

- Learner programs are parsed by a deliberately small interpreter, not passed to JavaScript or Python evaluation. Source size, structure, and execution are bounded; recursion and unknown syntax are rejected.
- Game progress and drafts use browser-profile-local storage. The game has no learner accounts, analytics, or backend that receives journals. A hosting provider may still process ordinary requests for app files under its own policies.
- Journal import validates known fields and asks before replacing current progress. Treat backups as personal files, inspect their destination before sharing, and do not import files from an untrusted source.
- Browser storage and offline caches are not a secure vault. People with access to the same browser profile may be able to read or change progress. Private browsing, storage policies, clearing data, or device loss can remove it.
- Export a journal before clearing site data or changing devices. There is no server-side recovery. The app's **Erase progress** control concerns saved progress, not a promise to remove every browser cache or external copy.

Source tests and simulated offline-cache checks are not a security audit, proof of browser isolation, or physical-device validation. See [quality boundaries](docs/code-review.md) for the evidence established so far.
