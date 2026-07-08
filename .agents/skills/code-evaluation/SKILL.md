---
name: code-evaluation
description: >-
  Perform an honest, evidence-based evaluation of code or tests across the
  reviewer's fixed dimensions (code quality, readability, maintainability,
  completeness, branch coverage, consistency, separation of concerns,
  testability, correctness, security). Use when the user asks to evaluate,
  review, assess, critique, or give an honest evaluation of a module, service,
  function, or test suite — e.g. "evaluate the code quality of X", "give an
  honest evaluation of ... readability, maintainability, branch coverage and
  consistency", or "evaluate the replacement / separation of concerns /
  testability".
---

# Code Review

Deliver an honest, balanced, evidence-based evaluation of code or tests. The
default output is an **assessment**, not edits. Only modify files after the user
explicitly asks (and you are in Agent mode).

## Workflow

Copy this checklist and track progress:

```
- [ ] Step 1: Scope the review (what to review, honor any exclusions)
- [ ] Step 2: Gather context (target + code under test + a sibling for consistency)
- [ ] Step 3: Evaluate across the fixed dimensions
- [ ] Step 4: Verify every suspected bug empirically before asserting it
- [ ] Step 5: Write the review (summary, what's good, issues by severity, table, fixes)
- [ ] Step 6: Offer to apply fixes
```

### Step 1: Scope the review

Identify exactly what is under review. **Honor explicit exclusions verbatim** —
if the user says "do not comment on assertion inconsistencies between the
workspace and auth controllers", do not raise them, even if you spot them.

If the request is genuinely ambiguous about scope, ask once (via `AskQuestion`).
Otherwise proceed.

### Step 2: Gather context

Do not review a file in isolation. Read, at minimum:

1. **The target** under review.
2. **The production code it exercises** — for tests, read the service/controller
   being tested so you can judge branch coverage and completeness against the
   real control flow.
3. **A sibling / analogous file** to judge consistency against established
   project conventions (e.g. compare a new `*.service.test.ts` against the
   existing `workspace.service.test.ts`; compare `token-service` against
   `password-hasher`). Consistency findings must cite the pattern they deviate
   from.

Also read the wiring that affects correctness: DI/factory setup, `jest.config`,
`tsconfig` (e.g. `noUncheckedIndexedAccess`), schemas, and shared
assertions/fixtures.

### Step 3: Evaluate across the fixed dimensions

Assess these dimensions. Include the ones the user named; add any that surface
real findings. Skip a dimension only if it is truly irrelevant to the target.

| Dimension | What to look for |
|---|---|
| **Correctness** | Real bugs, wrong semantics, latent footguns, wrong HTTP status/error type |
| **Code quality** | Fail-fast ordering, single-responsibility helpers, appropriate log severity, precise queries |
| **Readability** | Domain-meaningful names, spec-like structure, consistent Arrange-Act-Assert |
| **Maintainability** | Redundancy, dead code, noisy defensive code, shared vs inlined fixtures |
| **Completeness** | Untested seams/branches, missing edge cases, unspecified behavior |
| **Branch coverage** | Every branch of the code under test is exercised — and distinguish this from **behavioral** coverage (asserting call args, logs, side effects, not just the return value) |
| **Consistency** | Naming, structure, assertion depth, and conventions vs sibling files |
| **Separation of concerns** | Domain rules in the domain layer; repositories answer questions, services decide; no infra leaking into business logic |
| **Testability** | Decoupled from infrastructure, mockable seams, no reliance on real crypto/DB in unit tests |
| **Security** | Algorithm pinning, no leaking which auth factor failed, no sensitive data in responses, unsafe casts of untrusted input |

### Step 4: Verify before asserting

Never claim a bug from inspection alone when it is cheaply verifiable. Confirm it
first, then cite the evidence in the review:

- Reproduce runtime behavior with a throwaway script (e.g. `node -e "..."`).
- Type-check with `npx tsc --noEmit`.
- Run the relevant suite (`npm run test:unit -- <file>`,
  `npm run test:integration`, or a scoped `jest` invocation).

If a suspected issue turns out to be a false alarm, drop it.

Also apply judgment about what NOT to recommend: **do not propose tests or changes
that lock in unintended behavior.** If behavior is merely unspecified (e.g. email
normalization when the schema has no `.toLowerCase()/.trim()`), flag it as a
product decision rather than writing a test that pins the current behavior.

### Step 5: Write the review

Use these sections in order:

1. **`## Summary`** — one honest paragraph: overall quality, the headline
   strengths, and the most important problems. A letter grade (e.g. A-) is
   welcome when it fits.
2. **`## What's good`** — a bullet list of genuine, specific strengths, not
   filler praise.
3. **`## Issues`** — a numbered list. Each item starts with a short title and a
   severity tag, e.g. `**1. Leaking spy → false positive (High).**`, states what
   it is and *why it matters*, then shows the offending code in a
   `startLine:endLine:filepath` reference block, then gives the concrete fix.
4. **`## Minor nits`** — low-stakes polish, clearly separated from real issues.
5. **`## Assessment`** — a table mapping each dimension to a short assessment:

```
| Dimension | Assessment |
|---|---|
| Correctness | ... |
| Consistency | ... |
```

6. **`## Recommended priority`** — a numbered fix list, highest-impact first.

Rules for the review body:
- **Be honest and balanced.** Include real strengths and real problems. Never
  pad with vague praise, and never soften a genuine bug.
- **Rank by severity** (High / Medium / Low, or Critical / minor nit). Keep nits
  visibly separated from real issues.
- **Every issue cites a code reference** using the `startLine:endLine:filepath`
  format, and explains *why* it matters — not just what it is.
- Use before/after tables when contrasting two approaches.
- Prefer specific, actionable fixes over general advice.

### Step 6: Offer to apply fixes

End by offering to apply the fixes (e.g. "Want me to apply these?"). Do not edit
files until the user agrees. When they do, work through the prioritized list,
re-verify (type-check + run tests), and summarize exactly what changed and
anything intentionally skipped (with the reason).

## Anti-patterns to avoid

- Reviewing a file without reading the code it exercises or a sibling for
  consistency.
- Asserting a bug you did not verify when verification was cheap.
- Commenting on anything the user explicitly excluded from scope.
- Vague praise ("looks good, clean code") with no specifics.
- Treating branch coverage as sufficient while ignoring behavioral coverage.
- Recommending tests that lock in unintended or merely-unspecified behavior.
- Editing files during a review that was only asked to be an evaluation.
