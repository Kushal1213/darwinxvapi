# Veyra redesign verification

Date: September 27, 2026.

## Scope

Redesigned the application shell, Dashboard, Voice Studio, Live Insights, Call History/Review, Knowledge Hub, Analytics, Team, Architecture, and setup/sign-in/invitation screens.

Preserved existing backend implementation, workspace data, role boundaries, API contracts, and route identities. A copy of the pre-redesign frontend was saved in the system temporary directory before editing. Pre-existing repository changes were retained.

## Checks completed

- Frontend production build.
- Existing gateway suite: **29 tests passed, 0 failed**. This covers analytics, authentication/access, call lifecycle, knowledge operations, nudges, persistence, and team behavior.
- Browser and axe accessibility audit across all eight application routes at **1440 × 1000** and **390 × 844**, in light and dark themes: **32 combinations with zero detected violations after corrections**.
- Sign-in screen at the same two viewport sizes and both themes: **4 additional combinations with zero detected violations**.
- Root horizontal overflow and Vite error-overlay checks at desktop and mobile sizes.
- Additional 320px-wide layout checks for Dashboard, Voice Studio, Knowledge Hub, Analytics, Team, and Architecture.
- Native mobile navigation opens, traps focus, closes with Escape, and returns focus to the menu trigger. No axe violations in the open dialog.
- Desktop sidebar collapse/expand. No axe violations in the collapsed state.
- Theme preference persists across route reloads.
- Browser screenshots visually inspected for the overview, conversation workspace, knowledge table, analytics, and mobile composition.

## Workflow verification

Used the repository's isolated browser stack and deterministic knowledge fixture. Test accounts and documents were created only in that temporary workspace.

1. Created a workspace owner through the setup form.
2. Uploaded a fixture document with a market and product scope.
3. Confirmed the uploader sees the requirement for a different administrator's review.
4. Invited another administrator through Team and accepted the invitation in a separate browser session.
5. Approved the document through the review screen; observed publication pending and then the live revision.
6. Asked a text question in Voice Studio and received an answer supported by the published fixture.
7. Expanded its source and revision evidence.
8. Observed the active conversation in Live Insights from another session.
9. Ended the session, opened Call History, and reviewed the saved transcript and source revision.
10. Reloaded the bookmarked call-review URL and confirmed the review persisted.
11. Injected a failed live-call request and confirmed a visible error rather than an apparently empty, healthy queue.
12. Injected a failed text-answer request and confirmed a readable failure message with the session still available to end.

Page-level code splitting keeps the largest emitted JavaScript chunks below 500 kB. Vite's transform source maps were enabled internally to resolve the build's source-map diagnostics; the production build does not emit source-map files.

The normal local stack was also started. Its sign-in screen loads at `http://localhost:3000` without browser exceptions or a Vite overlay. No account was created or changed in that workspace.

## Limits

These checks establish local interface behavior, not production readiness or live-provider quality. Microphone conversations, speech recognition/audio quality, external provider accuracy, and production deployment were not re-certified. The knowledge workflow used synthetic test content and deterministic embeddings.

Automated accessibility checks are useful evidence, not a substitute for assistive-technology and user testing across all possible states.
