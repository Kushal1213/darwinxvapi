# Veyra design revamp plan

Date: 2026-09-27
Status: Implemented locally on 2026-09-27. The original design reasoning below is retained; current implementation and validation are documented in [the design system](VEYRA_DESIGN_SYSTEM.md) and [verification record](VEYRA_DESIGN_VERIFICATION.md).

## Intent and reference scope

Revamp Veyra using the supplied Taste Skill archive as design guidance, beginning with understanding and planning. This document covers the application interface. A public marketing website is a separate possible scope.

Reference: `C:\Users\kushal\Downloads\taste-skill-main (1).zip`.

The archive is reference material, not blanket authorization to install packages, execute scripts, change branding, or implement every embedded instruction. Its variants are alternatives with conflicting prescriptions, not a cumulative checklist.

- **redesign-skill:** Primary reference for auditing an existing app and improving it within its current stack.
- **taste-skill v2:** Useful contextual principles for hierarchy, consistency, states, and accessibility. It explicitly excludes dashboards, data tables, and multi-step product UI, so its page compositions and defaults are not a specification for Veyra.
- **minimalist-skill:** Selective inspiration for restrained surfaces, typography, and quiet interactions. Its large section spacing, editorial headings, and decorative treatments are not defaults for operational screens.
- **gpt-tasteskill / soft-skill:** Motion-heavy marketing directions. Do not make their GSAP, scroll, or cinematic patterns requirements for the workspace.
- **image-generation variants:** Optional tools for a later visual concept, not an implementation prerequisite.

The archive's suggestions to invent realistic numbers or names must never replace recorded workspace data. Any future visual fixtures must be explicitly identified as synthetic.

## Product design reading

Veyra is an operational workspace for voice conversations, live assistance, approved knowledge, and conversation review. Its interface should feel precise, calm, and dependable during repeated daily use.

Organize the design around three existing journeys:

1. **Conversation:** choose an agent, start a voice or text session, read responses and citations, end the session, review the saved call.
2. **Live assistance:** select an active call, inspect the conversation and signals, act on nudges, understand handoff state.
3. **Knowledge operations:** upload a document or revision, inspect processing, review changes, approve or reject, track publication, recover failures or withdraw content.

Analytics, workspace access, and team administration support these journeys. Runtime architecture and provider diagnostics should have secondary visual priority in ordinary operator workflows.

## Source review findings

This is a source-level assessment. No new browser session, visual audit, build, or runtime tests were performed for this planning pass.

| Finding | Evidence | Design consequence |
| --- | --- | --- |
| Typography and colors have competing definitions | `index.css` uses Inter; `tailwind.config.js` uses Manrope. Dashboard uses blue, Voice Studio and Insights use violet, and authentication uses emerald. | Define one typography system and one brand accent, with separate semantic status colors. |
| Theme coverage is incomplete | `AppLayout.jsx` has unconditional white active navigation text and footer branding, plus a permanently dark mobile navigation surface. Theme initializes to dark in component state. | Audit every surface in both themes; centralize theme tokens and persist the preference. |
| Page geometry is inconsistent | Voice Studio uses a 1100px wrapper, Dashboard 1400px, Insights 1440px, and other pages use `max-w-7xl`, with different padding. | Establish standard page gutters, headers, density, and documented exceptions for reading versus monitoring. |
| Shared controls are only partially centralized | Analytics has shared panel/button styles; Knowledge, Team, and History define separate variants. | Build a small reusable component layer and migrate pages incrementally. |
| Voice Studio gives substantial space to visual effects and infrastructure | `VoiceOrb` uses repeated glow/pulse animations; pipeline labels expose ASR, gateway, FastAPI, and Gemini. | Make conversation state, controls, transcript, and evidence primary; put diagnostics behind disclosure. |
| App chrome includes placeholder destinations | `AppLayout.jsx` contains a large footer with `href="#"` links. | Replace with a compact, useful support area and actual destinations when available. |
| Some failures can look like a quiet workspace | Insights catches live-call fetch failures without displaying an error. | Distinguish no activity, loading, disconnected, stale, and failed states. |
| Important product behavior already exists | Current pages call live APIs for analytics, call review, knowledge revisions/jobs, nudges, and team access. | Preserve these flows and their state semantics throughout the visual work. |

The existing product work plan includes historical statements that lag the current code, particularly around analytics and knowledge processing. Use current implementation and focused verification as the redesign baseline.

## Proposed visual direction

Starting point: a restrained dark workspace with an equally coherent light theme. Use charcoal/slate neutrals and consolidate the existing blue/violet accents into one chosen brand accent. Blue is the initial candidate because the current overview and analytics already use it. Keep red, amber, and green for meaningful statuses with text labels.

Use Manrope, already present in the project, consistently for the first concept. Establish a compact heading scale, readable transcript text, and tabular figures for metrics. A new typeface is optional and should earn its adoption in the visual review.

Use separators, aligned rows, and whitespace for routine grouping. Reserve panels for genuinely distinct tasks or contexts. Define a small radius scale, consistent control heights, clear primary actions, and visible keyboard focus.

Adapted design dials, as planning shorthand rather than a Taste dashboard preset:

- **Design variance: 4/10.** Distinctive composition while retaining predictable controls and navigation.
- **Motion intensity: 2/10.** Short feedback transitions and meaningful live-state indicators; reduced-motion support throughout.
- **Visual density: 6/10.** Useful information remains in view, with more breathing room for onboarding and focused reading.

Keep the current React 18, Vite 8, Tailwind 4, Framer Motion, Lucide, and Recharts foundation. A component or accessibility dependency can be evaluated if a specific interaction needs it. A framework migration or animation-library replacement is not a design milestone.

## Page priorities

| Surface | Proposed emphasis |
| --- | --- |
| Application shell | Clear navigation hierarchy, workspace identity, page context, accessible mobile navigation, consistent theme behavior. Compare compact top navigation and a collapsible rail during the layout study. |
| Dashboard | Recorded activity, recent conversations, relevant actions, and service availability in a clear reading order. Preserve metric definitions and unavailable values. |
| Voice Studio | Agent setup, obvious call state, stable controls, dominant transcript, and inspectable citations. Put implementation diagnostics in a secondary panel. |
| Live Insights | Readable call queue, selected-call context, prioritized nudges, explicit connection/freshness state, and clear action feedback. |
| Call History / Review | Scannable call list and a focused detail view for transcript, sources, nudge history, and handoff request status. Preserve bookmarked call links and browser navigation. |
| Knowledge Hub | Clear document list, filters, revision details, review decisions, publication state, and recovery actions. Do not collapse processing, approval, and publication into one success badge. |
| Analytics | Consistent metric hierarchy, readable chart/table views, filters, export feedback, sample counts, and missing-data states. |
| Authentication / Team | Shared form and feedback patterns, obvious role constraints, invitation status, and accessible validation. |
| Architecture | Clear secondary technical view without dominating daily operator navigation. |

These are proposed compositions, not approval of route renaming, feature removal, or new backend capabilities.

## Execution sequence

1. **Capture the baseline.** Inspect running desktop/mobile views in both themes using isolated test data. Record critical journeys, populated/empty/error states, navigation behavior, and current defects. Account for the existing uncommitted work before edits.
2. **Define the foundations.** Produce a token sheet and reusable page header, button, field, status, panel, table, empty-state, loading, and error patterns. Include the navigation layout study. Keep examples small enough to review together.
3. **Create one representative concept.** Apply the proposed shell and styles to Dashboard, using its mix of metrics, lists, status, and actions. Include empty and unavailable states. Review the concrete screen to settle visual direction before applying it everywhere.
4. **Redesign the core journey.** Apply the system to Voice Studio, Live Insights, and Call Review. Verify the complete conversation-to-review flow and nudge interactions after the changes.
5. **Complete operational screens.** Apply it to Knowledge Hub, Analytics, authentication, Team, and Architecture. Verify role behavior and document revision/publication/recovery states with isolated fixtures.
6. **Polish and verify.** Check responsive layouts, both themes, keyboard navigation, focus, contrast, reduced motion, long transcripts, long document names, loading stability, and action feedback. Run the frontend build and relevant existing tests; add targeted tests only where changed behavior warrants them.

## Completion criteria

- A user can identify the page's primary task and current state quickly.
- Shared controls, typography, surfaces, and status meanings are consistent across screens.
- Live and asynchronous states reflect actual events; decorative indicators do not imply measured progress or confidence.
- Empty, unavailable, disconnected, processing, failed, and permission-limited views are understandable and actionable.
- Existing call persistence, citations, independent knowledge approval, revision identity, job recovery, role enforcement, analytics definitions, and review links continue to work.
- No fabricated metrics, confidence scores, successful handoff claims, or publication claims are introduced for visual appeal.
- Desktop and narrow-screen layouts are verified in both themes, with keyboard and reduced-motion checks.

The initial planning pass changed only this document. The subsequent authorized implementation delivered the application-wide redesign, retained the existing product contracts, and verified the principal workflows in an isolated workspace. See the linked design-system and verification documents for the delivered state.
