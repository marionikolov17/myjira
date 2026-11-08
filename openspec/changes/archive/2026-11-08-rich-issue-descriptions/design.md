# Design

## Context

The `description` field is a plain string end to end: Postgres `text`, server Zod `z.string().min(1)` with no upper bound, frontend Zod capped at 5000 (`ISSUE_DESCRIPTION_MAX_LENGTH` in `app/src/lib/api/schemas/issues.ts`). The UI is a bare textarea (`app/src/features/issues/components/detail/DescriptionEditor.tsx`, `CreateIssueDialog.tsx`) and the view renders one `<p>` with `whitespace-pre-wrap`. No markdown library, prose typography, or highlighter exists anywhere in `app/`.

Constraints that shape the approach:

- Server owns the contract: `server/docs/openapi.json` is **hand-maintained** (no generator script) and served at `/docs`; server Zod validates in controllers via `Schema.parse`, never in services.
- Frontend layering: shared UI lives in `components/common` and must not import `features/*`; features never import the transport directly.
- The app has light/dark theming (`next-themes`, `.dark` variant in `globals.css`) — any code-highlight palette must respond to it.
- No frontend tests (repo policy); backend tests are required where conventions say so.
- See `proposal.md` for motivation; see `specs/issues/spec.md` for the requirement set.

## Goals / Non-Goals

**Goals:**

- One shared, sanitized markdown renderer used by the issue detail view, the editor's preview mode, and nothing else yet — but built so comments and project descriptions can adopt it without changes.
- Markdown-as-source: the stored string is the author's source; render fidelity is identical between preview and saved view.
- Server input parity with the existing client cap, enforced through the standard validation path.
- Fail-closed safety: rendering cannot introduce executable content by default.

**Non-Goals (design-level):**

- No WYSIWYG. The editor abstraction (source textarea + toolbar + preview) must not block a later swap behind the same storage format, but building one now is out of scope.
- No server-side markdown awareness. The server never parses, validates, or transforms markdown — it stores and returns strings. Markdown validity is a client rendering concern.
- No markdown support for other text fields (project descriptions, titles) in this change.

## Decisions

### D1 — Render client-side; storage stays a raw markdown string

The server keeps `description` as an opaque string. Rendering happens in the client at view time.

*Alternatives:* server-side rendering to HTML (rejected — moves presentation into the API, changes the response shape, doubles the sanitization surface); storing an AST or HTML (rejected — kills portability and diffability; API shape change).

### D2 — Rendering pipeline: react-markdown + remark-gfm + remark-breaks + rehype-highlight, no rehype-raw

- `react-markdown` produces React elements — no `dangerouslySetInnerHTML` anywhere.
- `remark-gfm` supplies tables, strikethrough, task lists, autolinks.
- `remark-breaks` turns single line breaks into hard breaks — required for legacy plain-text descriptions to keep their visual line structure.
- `rehype-highlight` (lowlight, default common-language subset) highlights fenced blocks that declare a language.
- **No `rehype-raw`**: raw HTML never enters the render tree, which satisfies the sanitization requirement's "no element produced by that markup" scenario structurally rather than by filtering.
- Dangerous link protocols (`javascript:` etc.) are neutralized by react-markdown's built-in URL transform; no plugin disables it.
- External links: a custom `a` element mapping adds `target="_blank"` and `rel="noopener noreferrer"` for absolute URLs; relative URLs stay in-app anchors.

*Alternatives:* `marked` + DOMPurify (string HTML + `dangerouslySetInnerHTML` — a permanent footgun, sanitization is opt-in rather than structural); MDX (executes content — categorically wrong for user input); adding `rehype-sanitize` (only becomes necessary if `rehype-raw` is ever introduced — recorded as a hard precondition, not installed today).

### D3 — Images: component override renders alt text as a link, never an `<img>`

The markdown `image` node maps to a small component that renders the alt text as a link to the URL. No network image loads occur until attachment support exists. When attachments land, this single mapping is the seam to replace.

### D4 — Prose styling via `@tailwindcss/typography`

A `MarkdownView` wrapper applies `prose` classes (with dark-mode inversion) sized for the description context, with narrow overrides for code block backgrounds and link styling to match the app's tokens.

*Alternatives:* hand-mapped utility classes per element (more code to maintain, easy to drift from the construct set); inline styles (unmaintainable).

### D5 — Highlight palette: one token stylesheet driven by CSS variables that flip with `.dark`

A small hand-rolled `.hljs-*` token stylesheet whose colors are CSS variables, re-mapped under the existing `.dark` variant. No dual static theme imports.

*Alternatives:* shiki (VS Code-grade colors, but async, heavier runtime — revisit only if highlighting quality becomes a complaint); importing two static highlight.js themes with media scoping (fragile with class-based dark mode).

### D6 — Shared components: `MarkdownView` and `MarkdownEditor` in `components/common`

- `MarkdownView` — pure render: takes `children: string`, applies D2–D5. No feature knowledge.
- `MarkdownEditor` — generic Write/Preview surface: a textarea source mode, a tab/toolbar row, a link-insertion popover (text + URL fields), a live character counter, and a `maxLength` prop. Save/cancel wiring stays in the feature.

Per app rules, shared UI must not import features — both components satisfy that. `DescriptionEditor` becomes a thin feature wrapper owning draft state, the save contract (`onSave` → `useUpdateIssue`), and `canEdit` gating, delegating the surface to `MarkdownEditor`. `CreateIssueDialog` uses `MarkdownEditor` inside its RHF form (registering the textarea, rendering preview via `MarkdownView`).

*Alternatives:* keeping the editor inside `features/issues` and extracting later (rejected — the spec demands preview/view rendering parity, and reuse by comments/projects is the stated near-term path); a headless WYSIWYG framework (deferred per proposal).

### D7 — Toolbar operations are pure textarea selection transforms

Each affordance (heading, bold, italic, inline code, fenced code, list, blockquote, link) is a pure function from `{ value, selection }` to `{ value, selection }` — wrap selected text, insert scaffolding, or insert a link from the popover. No editor framework, no AST state, trivially testable by inspection. Keyboard shortcuts (Cmd/Ctrl+B, etc.) can be added as pure additions later.

### D8 — Server cap: Zod `.max(5000)` on both request schemas; OpenAPI updated by hand

- `server/src/modules/issues/issue.schema.ts`: `description: z.string().min(1).max(5000)` on `CreateIssueRequestParamsSchema` and `UpdateIssueRequestParamsSchema`. Validation stays in the controller (conventions); over-length input surfaces as a standard validation error identifying `description` via the existing `map-zod-error` path.
- `server/docs/openapi.json`: add `maxLength: 5000` to the `description` property of both request-body schemas — hand-edited, since the file is the manually maintained contract doc.
- Both client and server count the same measure: Zod string length (UTF-16 code units), so the boundary behaves identically on both ends (5000 accepted, 5001 rejected).

*Alternatives:* cap enforcement in the service layer (rejected — validation belongs in request schemas per module conventions); a DB constraint (rejected — the column is unbounded `text`, an app-level cap suffices, no migration).

## Risks / Trade-offs

- [User-authored markdown is an XSS surface] → Structural safety: no `rehype-raw`, built-in protocol sanitization kept on, `noopener noreferrer` on external links. Hard rule recorded: if raw HTML rendering is ever desired, `rehype-sanitize` must land first.
- [Legacy plain-text descriptions re-render under markdown semantics (e.g. a line starting `1.` becomes a list)] → `remark-breaks` preserves line structure; benign reinterpretation is accepted as the cost of richness. No data migration — legacy strings render fine as markdown.
- [Highlight bundle weight] → lowlight's common subset only (~35 languages); descriptions are capped at 5000 chars, so parsing cost is trivially small; `MarkdownView` memoizes on the source string.
- [`prose` classes can clash with shadcn tokens] → scope `prose` usage to the markdown containers, override the few clashing slots (links, code backgrounds) against the app's CSS variables.
- [Heading-level noise (markdown `#` producing another h1 under the issue title's h1)] → accepted; GitHub parity. The description section heading stays h2 and markdown headings live inside the article body.
- [Server cap rejects previously-accepted oversized input] → deployment-safe: the shipped frontend already refuses > 5000, so no existing client flow can exceed it; server order-first deployment (below) makes rollback independent.

## Migration Plan

1. **Server first**: Zod `.max(5000)` + OpenAPI `maxLength` + tests. Safe to deploy alone — existing clients already self-cap.
2. **Frontend second**: dependencies, shared components, editor + view swap. Rendering is additive; view falls back to plain text only if the feature is reverted.
3. **Rollback**: frontend revert restores today's textarea/plaintext view with no data impact (stored strings are valid either way). Server cap revert is independent and likewise data-neutral.
4. **No DB migration, no data transformation** for existing rows.

## Open Questions

- Exact keyboard-shortcut set for toolbar actions (Cmd/Ctrl+B/I/K…) — UI polish, additive later.
- Whether the character counter displays a running count or remaining budget — cosmetic; decide during implementation.
