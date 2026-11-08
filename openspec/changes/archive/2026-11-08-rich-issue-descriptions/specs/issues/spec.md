# Spec Delta

## ADDED Requirements

### Requirement: Issue descriptions render as markdown

The system SHALL render issue descriptions as markdown rather than plain text. The rendering SHALL support headings of all six levels, paragraphs, ordered and unordered lists, blockquotes, links, inline code, fenced code blocks, tables, task lists, strikethrough, and bare URLs rendered as links. Fenced code blocks that declare a language SHALL be syntax highlighted. A single line break inside a paragraph SHALL render as a line break.

#### Scenario: Structured description renders with its formatting

- **WHEN** an issue description contains markdown headings, lists, links, and fenced code blocks
- **THEN** the rendered description displays each construct with its corresponding visual structure instead of raw syntax characters

#### Scenario: Fenced code block with a declared language is highlighted

- **WHEN** a rendered issue description contains a fenced code block that declares a language
- **THEN** the code block renders with syntax coloring appropriate to the declared language

#### Scenario: A single line break renders as a line break

- **WHEN** an issue description contains a paragraph broken across lines by single line breaks
- **THEN** the rendered description preserves those line breaks visually

#### Scenario: Task list renders as non-interactive checkboxes

- **WHEN** a rendered issue description contains a markdown task list
- **THEN** the task items render with checkbox indicators that the reader cannot toggle

### Requirement: Markdown image syntax does not render as images

The system SHALL NOT render markdown image syntax as an image. Image syntax SHALL render as the image's alt text formatted as a link to the image URL.

#### Scenario: Image syntax renders as a link, not an image

- **WHEN** a rendered issue description contains markdown image syntax with alt text and a URL
- **THEN** the rendered description displays the alt text as a link to the URL
- **AND** no image is loaded or displayed

### Requirement: Rendered descriptions are sanitized

The system SHALL sanitize rendered issue descriptions. Raw HTML in a description SHALL NOT be rendered as markup. Link protocols that can execute code SHALL be neutralized. External links SHALL open in a new tab with `noopener` and `noreferrer` link relationships.

#### Scenario: Script markup in a description does not execute

- **WHEN** an issue description contains HTML script markup
- **THEN** the rendered description executes no script and contains no element produced by that markup

#### Scenario: Dangerous link protocol is neutralized

- **WHEN** a rendered issue description contains a markdown link whose URL uses a protocol that can execute code
- **THEN** the rendered link does not carry the dangerous protocol in its navigation target

#### Scenario: External links open safely in a new tab

- **WHEN** a rendered issue description contains a link to an external URL
- **THEN** the link opens in a new browser tab with `noopener` and `noreferrer` relationships

### Requirement: Description editing offers source and preview modes with insert affordances

The system SHALL provide, wherever a description can be authored, an editor with a source mode for writing markdown and a preview mode showing the rendered result. The editor SHALL offer affordances that insert heading, bold, italic, link, code, list, and blockquote syntax, and SHALL indicate when the authored description exceeds the maximum length. Preview mode SHALL use the same rendering and sanitization as the saved description view.

#### Scenario: Preview reflects the saved rendering

- **WHEN** an author switches the description editor to preview mode
- **THEN** the preview renders the authored markdown exactly as the description will render once saved

#### Scenario: Link insertion affordance

- **WHEN** an author uses the editor's link affordance and supplies link text and a URL
- **THEN** the editor inserts markdown link syntax into the description source

#### Scenario: Over-length draft is flagged before submission

- **WHEN** the authored description exceeds the maximum length
- **THEN** the editor indicates the over-length condition and prevents submission until the description is within the limit

#### Scenario: Issue creation offers the same editor

- **WHEN** an actor opens the issue creation dialog
- **THEN** the description field provides the same source and preview modes and insert affordances as the issue detail editor

## MODIFIED Requirements

### Requirement: Mandatory and strict create-issue input

The system SHALL require the create-issue request body to carry `title` and `description` as non-empty strings. The system SHALL require `description` to be at most 5000 characters. The system SHALL accept `priority` and `assigneeId` as optional fields when provided. The system SHALL reject payloads that omit `title` or `description`, provide a `description` longer than 5000 characters, provide a malformed `assigneeId`, provide a `priority` that is not one of the configured enum values, or include any additional field — including the `status` field, which the system SHALL always set and never accept from the client. Rejections of these shape constraints SHALL be surfaced as validation errors identifying the offending field.

#### Scenario: Missing title is rejected

- **WHEN** a create-issue request omits `title`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Missing description is rejected

- **WHEN** a create-issue request omits `description`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Empty title is rejected

- **WHEN** a create-issue request provides a `title` that is the empty string
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Empty description is rejected

- **WHEN** a create-issue request provides a `description` that is the empty string
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Over-length description is rejected

- **WHEN** a create-issue request provides a `description` that is longer than 5000 characters
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Malformed assigneeId is rejected

- **WHEN** a create-issue request provides an `assigneeId` that is not a well-formed user identifier
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Unknown priority value is rejected

- **WHEN** a create-issue request provides a `priority` that is not one of the configured enum values
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: status field in the payload is rejected

- **WHEN** a create-issue request includes a `status` field, regardless of its value
- **THEN** the system rejects the request with a validation error identifying `status` as an offending field
- **AND** no issue row is created

#### Scenario: Extra fields in the payload are rejected

- **WHEN** a create-issue request includes any field other than `title`, `description`, `priority`, and `assigneeId`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Non-object payload is rejected

- **WHEN** a create-issue request body is not a plain object
- **THEN** the system rejects the request with a validation error
- **AND** no issue row is created

### Requirement: Mandatory and strict update-issue input

The system SHALL accept the update-issue request body as a plain object carrying any subset of `title`, `description`, `status`, `priority`, and `assigneeId`, with at least one of those fields present. The system SHALL reject payloads that provide an empty body, a `title` that is the empty string, a `description` that is the empty string, a `description` longer than 5000 characters, a `status` that is not one of the configured enum values, a `priority` that is not one of the configured enum values, a malformed `assigneeId`, or any field other than those five. Rejections of these shape constraints SHALL be surfaced as validation errors identifying the offending field.

#### Scenario: Empty body is rejected

- **WHEN** an update-issue request body is an object with no fields
- **THEN** the system rejects the request with a validation error
- **AND** no issue row is modified

#### Scenario: Empty title is rejected

- **WHEN** an update-issue request provides a `title` that is the empty string
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Empty description is rejected

- **WHEN** an update-issue request provides a `description` that is the empty string
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Over-length description is rejected

- **WHEN** an update-issue request provides a `description` that is longer than 5000 characters
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Unknown status value is rejected

- **WHEN** an update-issue request provides a `status` value that is not one of the configured enum values
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Unknown priority value is rejected

- **WHEN** an update-issue request provides a `priority` value that is not one of the configured enum values
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Malformed assigneeId is rejected

- **WHEN** an update-issue request provides an `assigneeId` that is not a well-formed user identifier
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Extra fields in the payload are rejected

- **WHEN** an update-issue request includes any field other than `title`, `description`, `status`, `priority`, and `assigneeId`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Non-object payload is rejected

- **WHEN** an update-issue request body is not a plain object
- **THEN** the system rejects the request with a validation error
- **AND** no issue row is modified
