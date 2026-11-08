# Proposal

## Why

Issue descriptions render as raw plain text — a single paragraph that preserves newlines and nothing else. Real issue documentation needs structure: headings to organize long write-ups, links to references, and code blocks with highlighting for errors and snippets. The description is the primary artifact of an issue, yet today it is the least expressive field in the product.

## What Changes

- Issue descriptions become **markdown documents**. The rendered view supports a markdown superset: headings (h1–h6), paragraphs, ordered/unordered lists, blockquotes, links, inline code, fenced code blocks **with syntax highlighting**, tables, task lists, strikethrough, and autolinked bare URLs. A single line break renders as a line break (GitHub-style), preserving the visual fidelity of existing plain-text descriptions.
- The description editor upgrades from a bare textarea to a **Write/Preview editor with an insert toolbar** (heading, bold/italic, link insertion, code, lists, blockquote) in both the issue detail view and the create-issue dialog. Preview uses the exact same renderer as view mode, so authors see what readers will see.
- Descriptions are **sanitized when rendered**: raw HTML is never rendered, dangerous link protocols (such as `javascript:`) are neutralized, and external links open in a new tab with `rel="noopener noreferrer"`.
- Markdown **image syntax does not render as images** in this change — it renders as its alt text as a link until attachment support exists.
- The description length limit of 5000 characters becomes a **server-enforced constraint** on create-issue and update-issue inputs, closing the current gap where the frontend refuses input over 5000 characters but the server accepts unbounded text. The editor shows a live character counter.

### Non-goals (deferred)

- File uploads and image attachments.
- Rendering markdown image syntax as images.
- Rich descriptions for project descriptions or subtasks (subtasks have no server API yet).
- Interactive task-list checkboxes (task lists render but cannot be toggled).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `issues`: description requirements expand — markdown rendering with an enumerated construct set and sanitization rules, a description editing surface with Write/Preview and insert affordances, and a 5000-character maximum enforced on create-issue and update-issue request validation.

## Impact

- **Frontend (`app/`)**: new rendering dependencies (a react-markdown pipeline with remark-gfm, remark-breaks, and rehype-highlight, plus prose styling for rendered markdown); a new shared markdown view component under `components/common` (reusable later by comments and project descriptions); `DescriptionEditor` rewritten as the Write/Preview editor with toolbar and character counter; `CreateIssueDialog` description field upgraded to the same editor. Frontend Zod (`issueDescription`) already enforces the 5000-character cap — unchanged.
- **Backend (`server/`)**: `issue.schema.ts` adds the 5000-character maximum to description on create and update request schemas; `docs/openapi.json` documents the limit; integration tests cover the over-limit validation error identifying `description`.
- **No database migration** — the `description` column is already unbounded `text`; the cap is application-level.
- **No API shape change** — `description` remains a plain string in every request and response; only its input constraint changes.
