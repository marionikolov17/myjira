# Issue Comments Specification

## Purpose
Lets users collaborate on an issue inside the app: anyone who can view an issue may read and post
comments on it, and users may remove only their own comments.

## Requirements

### Requirement: Issue comments are visible to issue viewers
The system SHALL expose the comments posted on an issue, ordered oldest first, to any user who can
view that issue: a project member holding any project role on the issue's project, or a workspace
Owner/Admin. Each exposed comment SHALL identify its body, its author (id, name, email), and its
creation and last-update timestamps.

#### Scenario: Project member lists an issue's comments
- **WHEN** a user holding any project role on the issue's project requests the comments of an issue in that project
- **THEN** the system returns every comment posted on that issue, ordered oldest first

#### Scenario: Workspace Owner/Admin without a project role lists an issue's comments
- **WHEN** a workspace Owner or Admin who holds no project role on the project requests the comments of one of its issues
- **THEN** the system returns every comment posted on that issue, ordered oldest first

#### Scenario: User who cannot view the issue requests its comments
- **WHEN** a user who cannot view the issue (no project role on the project and no workspace Owner/Admin bypass) requests its comments
- **THEN** the system rejects the request with a forbidden error and exposes no comments

#### Scenario: Comments are requested for a nonexistent issue
- **WHEN** comments are requested for an issue id that does not exist within the given project
- **THEN** the system responds with a not-found error

#### Scenario: Unauthenticated comment listing
- **WHEN** a request without valid authentication credentials requests an issue's comments
- **THEN** the system rejects the request with an authentication-required error

### Requirement: Viewers can post comments on an issue
The system SHALL allow any user who can view an issue to post a comment on it. A comment SHALL
consist of non-empty text, be attributed to the posting user as its author, and appear in the
issue's comment list after being posted.

#### Scenario: Project member posts a comment
- **WHEN** a user holding any project role on the issue's project posts a comment with non-empty text
- **THEN** the system stores the comment attributed to that user and returns it with its author and creation timestamp

#### Scenario: Workspace Owner/Admin without a project role posts a comment
- **WHEN** a workspace Owner or Admin who holds no project role on the project posts a comment on one of its issues
- **THEN** the system stores the comment attributed to that user

#### Scenario: Comment with an empty body is rejected
- **WHEN** a viewer posts a comment whose body is empty, blank, or missing
- **THEN** the system rejects the request with a validation error and stores no comment

#### Scenario: Comment posted on a nonexistent issue
- **WHEN** a comment is posted to an issue id that does not exist within the given project
- **THEN** the system responds with a not-found error and stores no comment

#### Scenario: User who cannot view the issue posts a comment
- **WHEN** a user who cannot view the issue posts a comment on it
- **THEN** the system rejects the request with a forbidden error and stores no comment

### Requirement: Users can delete only their own comments
The system SHALL allow a comment to be deleted only by its author, and only while the author can
still view the issue. A deleted comment SHALL no longer appear in the issue's comment list.

#### Scenario: Author deletes their own comment
- **WHEN** the author of a comment, who can view the issue, deletes that comment
- **THEN** the system removes the comment and it no longer appears in the issue's comment list

#### Scenario: Viewer attempts to delete another user's comment
- **WHEN** a user who can view the issue attempts to delete a comment authored by a different user
- **THEN** the system rejects the request with a forbidden error and the comment remains

#### Scenario: Comment author who lost issue access attempts deletion
- **WHEN** the author of a comment can no longer view the issue (removed from the project, without a workspace Owner/Admin bypass) and attempts to delete their comment
- **THEN** the system rejects the request with a forbidden error and the comment remains

#### Scenario: Deletion of a comment that does not exist
- **WHEN** a viewer attempts to delete a comment id that does not exist on that issue
- **THEN** the system responds with a not-found error

### Requirement: Deleting an issue removes its comments
The system SHALL remove every comment posted on an issue when that issue is deleted.

#### Scenario: Issue deletion removes its comments
- **WHEN** an issue that has comments is deleted
- **THEN** none of its comments remain in the system
