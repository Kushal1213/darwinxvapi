# Veyra interface system

Implemented September 27, 2026 using the supplied Taste archive as contextual redesign guidance.

## Direction

Calm operational software with a restrained blue accent, clear evidence, readable conversations, and consistent controls. The redesign covers authentication and every routed application page. It keeps the existing React, Vite, Tailwind 3, Lucide, Framer Motion, and Recharts stack.

## Foundations

- `src/index.css` defines semantic light/dark tokens for canvas, surface, secondary surface, text, muted text, borders, accent, success, warning, and error.
- Manrope is self-hosted in `public/fonts`, with the accompanying SIL Open Font License. No Google Fonts request is required.
- Dark is the initial default. The selected theme persists under `veyra-theme`; a small document bootstrap applies it before the first render.
- Surfaces use 6–10px corners, thin borders, and restrained elevation. Small badges communicate state with a text label as well as color.
- Page titles use a compact scale. Conversation text gets more room and line height; numeric metrics use tabular figures.
- Motion is limited to feedback and loading. Reduced-motion preferences suppress transitions, skeleton animation, and microphone-level movement.

## Reusable pieces

`src/components/WorkspaceUI.jsx` contains the theme provider, brand, page heading, status badge, empty state, skeleton loading state, and text action.

| Pattern | Use |
| --- | --- |
| `page`, `PageHeading` | Consistent content gutters, title, description, and page actions |
| `panel`, `panel-header`, `panel-title` | A distinct task or data context |
| `btn`, `btn-primary`, `btn-danger` | Standard, primary, and destructive actions |
| `field` | Inputs, selects, and text areas |
| `metrics-strip`, `MetricCard` | Related measurements with definitions and missing-data states |
| `data-table` | Scannable records with overflow contained inside the table |
| `StatusBadge` | Neutral, success, warning, error, or accent status |
| `EmptyState`, `LoadingState`, `notice` | Explicit empty, pending, and failed states |
| `message-content`, `source-detail` | Readable transcript turns and expandable source evidence |

Use semantic tokens and these patterns for future pages. Avoid adding a page-specific palette or another family of controls.

## Navigation and responsive behavior

Desktop navigation groups the existing route labels into Workspace, Intelligence, and Manage. A collapsible rail provides more room for content. Tablet layouts use a compact rail. Phones use a native modal navigation dialog with keyboard dismissal, focus return, and background scroll lock.

Voice Studio switches the agent list to a select on phones. Tables scroll within their containers, and forms and panels stack. Inputs use a larger mobile font to remain readable.

Existing `?tab=` navigation, path aliases, and bookmarked `?tab=history&call=` links continue to work. Page bundles load on demand.

## Data and interaction rules

- Display recorded values; preserve unavailable values instead of fabricating data.
- Citation presence is not accuracy. Expandable sources expose every returned source and revision metadata.
- A handoff request is not a confirmed transfer.
- Knowledge processing, independent approval, publication, withdrawal, and recovery remain distinct states.
- Live Insights distinguishes an empty call queue from a failed request or disconnected socket.
- Architecture is a descriptive system map with real health checks, not a simulated live log.
- Diagnostic timing belongs in secondary details. It must not imply end-to-end voice performance.

Implementation validation is recorded in [Veyra redesign verification](VEYRA_DESIGN_VERIFICATION.md).
