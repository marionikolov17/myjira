# Tasks

## 1. Server: description length cap (D8)

- [x] 1.1 Add `.max(5000)` to `description` in `CreateIssueRequestParamsSchema` and `UpdateIssueRequestParamsSchema` in `server/src/modules/issues/issue.schema.ts`; verify `npm run lint` and `npm run prettier` pass in `server/`
- [x] 1.2 Add over-length `description` rejection cases to the existing issues integration validation-error tests — create rejected with a validation error identifying `description` and no row created; update rejected with a validation error identifying `description` and no row modified (read `.cursor/rules/backend/integration-tests-pattern.mdc` before writing); verify `npm run test:integration` passes
- [x] 1.3 Add `maxLength: 5000` to the `description` property of both issue request-body schemas in `server/docs/openapi.json`; verify the edited JSON stays valid and the served spec at `/docs` shows the limit

## 2. App: markdown rendering foundation (D2–D6)

- [x] 2.1 Install `react-markdown`, `remark-gfm`, `remark-breaks`, `rehype-highlight`, and `@tailwindcss/typography` in `app/`; verify install completes and `npm run lint` still passes
- [x] 2.2 Create `app/src/components/common/MarkdownView.tsx` — react-markdown pipeline with remark-gfm, remark-breaks, rehype-highlight; no `rehype-raw`; image nodes render alt text as a link; external links get `target="_blank"` + `rel="noopener noreferrer"`; memoized on the source string; verify `npx tsc --noEmit` and `npm run lint` pass
- [x] 2.3 Add markdown styling — register `@plugin "@tailwindcss/typography"` in `app/src/app/globals.css`, apply dark-inverted `prose` classes with narrow overrides for code blocks and links, and add a `.hljs-*` token stylesheet whose colors are CSS variables re-mapped under `.dark`; verify `npm run dev` compiles with no CSS errors
- [x] 2.4 Create `app/src/components/common/MarkdownEditor.tsx` — Write/Preview tabs (preview rendered by `MarkdownView`), toolbar of pure `{ value, selection }` transforms for heading, bold, italic, inline code, fenced code, list, and blockquote, a link-insertion popover (text + URL), and a live character counter driven by a `maxLength` prop that flags over-length and blocks save; verify `npx tsc --noEmit` and `npm run lint` pass

## 3. App: issue surfaces adopt the editor (D6)

- [x] 3.1 Rewrite `DescriptionEditor` as a thin wrapper — view mode renders via `MarkdownView`; edit mode delegates to `MarkdownEditor` with draft state, Escape/cancel, save disabled while over-length or saving, and `canEdit` gating unchanged; verify a rich description on the issue detail view renders headings, lists, tables, task lists, highlighted code, preserved line breaks, and image syntax as alt-text links
- [x] 3.2 Swap the `CreateIssueDialog` description textarea for `MarkdownEditor` inside the existing RHF form (register the source textarea; keep Zod validation and `handleFormError` mapping); verify creating an issue with a markdown description succeeds and it renders richly on the detail view
- [x] 3.3 Verify sanitization behaviors in the running app — a description containing `<script>` markup renders no element and executes nothing; a `[link](javascript:alert(1))` link is neutralized; an external link opens in a new tab with `noopener noreferrer`; a relative link navigates in-app

## 4. Integration checks

- [x] 4.1 Run the full backend suite (`npm run test` in `server/`) — unit + integration pass, including the new cap scenarios
- [x] 4.2 Run the app quality gates in order (`npm run prettier`, `npm run lint`, `npx tsc --noEmit` in `app/`) — all clean
- [x] 4.3 End-to-end pass with both dev servers running — create an issue with a rich markdown description (headings, paragraphs, links, highlighted code, table, task list), edit it via Write/Preview with the toolbar including link insertion, and confirm the 5000-character cap round-trips (client blocks an over-length save; a direct 5001-character API request is rejected with a validation error identifying `description`)

## Workflow follow-up

- Archive the change after implementation is complete and review requirements are satisfied.
- Verify the archived result.
