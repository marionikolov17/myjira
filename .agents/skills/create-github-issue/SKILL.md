---
name: create-github-issue
description: >-
  Create a new GitHub issue in the myjira repository using the project's
  standard issue template (Context, Acceptance Criteria, Tests, Definition of
  Done) and matching the granularity of existing issues. Use when the user asks
  to create, open, draft, or file a GitHub issue for the myjira repo.
---

# Create GitHub Issue (myjira)

Create issues in the **myjira** repository that match the project's established
template, structure, and granularity, then create them via the GitHub MCP
server after the user approves the draft.

## Workflow

Copy this checklist and track progress:

```
- [ ] Step 1: Read the user's issue prompt and resolve ambiguities
- [ ] Step 2: Determine the repository (must be myjira)
- [ ] Step 3: Draft the issue (title + body) using the template
- [ ] Step 4: Show the draft and get explicit approval
- [ ] Step 5: Create the issue via GitHub MCP
- [ ] Step 6: Return the created issue URL
```

### Step 1: Read the prompt and resolve ambiguities

The user invokes this skill with a prompt describing what the issue should be.

**Only ask follow-up questions if there are genuine ambiguities in the
requirements** — e.g. an unspecified endpoint path, unclear error semantics,
missing acceptance criteria, or an undefined data shape. If the prompt is clear
and complete, do NOT ask questions; proceed to draft. Prefer the `AskQuestion`
tool for any clarifications, batching them into a single request.

Do not invent requirements. If a detail is genuinely optional or has an obvious
project default, choose the reasonable default and note it in the draft rather
than interrupting.

### Step 2: Determine the repository

This skill only creates issues in the **myjira** repository. Determine the
`owner` and `repo` from the current git remote (`git config --get
remote.origin.url`). Confirm the repo name is `myjira` before creating. Never
create issues in any other repository.

### Step 3: Draft the issue

Match the **structure and granularity** of existing myjira issues. See
[example-issue.md](example-issue.md) for a full reference issue that sets the
expected level of detail. Follow the template exactly.

**Title convention** (GitHub issue title, not the body):

- Prefix with the change type, matching existing issues: `Feat: `, `Fix: `,
  `Chore: `, `Docs: ` (use the prefix that fits the work). Optionally group with
  a domain segment, e.g. `Feat: Authentication: Login Endpoint`.
- The body's top-level `## <Issue Name>` heading uses the **plain** issue name
  (no prefix), e.g. `## Login Endpoint`.

**Body template** (fill every section; keep the exact section headings):

```markdown
## <Issue Name>

### Context

<Detailed explanation of this issue and its implementation. Break into bold
subsections (e.g. **Architecture**, **Environment Variables**, **Error Class**,
**Endpoint Flow**) when relevant. Include request/response examples in fenced
code blocks and tables for structured properties, matching the reference
example's granularity.>

### Acceptance Criteria

<Concrete, verifiable criteria grouped under bold subsections (e.g. **Success**,
**Validation**, **Invalid Credentials**). Each criterion is a bullet describing
an observable outcome, including exact status codes, error codes, and messages
where applicable.>

### Tests

**Unit Tests**

<What unit tests to create and the coverage expectation.>

**Integration Tests**

<What integration tests to create; explicitly cover the acceptance criteria.>

### Definition of Done

- [ ] Specifications of the task are implemented
- [ ] All acceptance criterias are working functionally
- [ ] Unit tests are created for applicable files
- [ ] Integration tests are created for applicable files and to cover the acceptance criteria
- [ ] For a new route, an OpenAPI specification is documented after implementation and finish of the upper points
```

**Definition of Done rules:**

- Always include all five checklist items, left **unchecked** (`- [ ]`) for a
  new issue.
- Keep the wording verbatim.

**Granularity guidance:**

- For feature endpoints, be as detailed as the reference example: specify module
  architecture (interfaces, services, controllers, schemas, `index.ts` wiring),
  error classes/codes, environment variables, endpoint flow, and full
  request/success/error payloads.
- For small fixes or docs tasks, keep the Context concise but still populate
  every template section (Acceptance Criteria and Tests may be short but must be
  present and verifiable).

### Step 4: Show the draft and get approval

Present the complete drafted title and body to the user (rendered markdown), plus
the proposed label. **Do not create the issue until the user explicitly
approves.** Incorporate any requested changes and re-confirm.

### Step 5: Create the issue via GitHub MCP

Use the GitHub MCP server tool `issue_write` with `method: "create"`.

- Check the tool schema before calling.
- Set `owner` and `repo` to the myjira repository resolved in Step 2.
- Set `title` (with prefix) and `body` (the drafted markdown).
- Apply exactly one `labels` entry inferred from the change type:
  - New feature / enhancement → `enhancement`
  - Bug fix → `bug`
  - Documentation → `documentation`
  - If the correct label is ambiguous, ask the user before creating.

### Step 6: Return the result

Report the created issue number and URL.
