import { afterAll, beforeAll, beforeEach, describe, it, jest } from '@jest/globals';
import supertest from 'supertest';

import { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { prisma } from '@/common/lib/prisma';
import { WorkspaceRoleName } from '@/modules/workspace-roles';

import { createTestUsers } from '../../fixtures/users.fixtures';
import { ensureWorkspaceRolesSeeded } from '../../fixtures/workspace-roles.fixtures';
import { ensureProjectRolesSeeded } from '../../fixtures/project-roles.fixtures';
import {
  requireTestUser,
  tokenFor,
  userToActorContext,
} from '../../fixtures/actor-context.fixtures';

import {
  expectAuthenticationRequired,
  expectForbiddenError,
  expectInternalServerError,
  expectResourceNotFoundError,
  expectValidationError,
} from '../../assertions/errors.assertions';
import { expectNoContentResponse } from '../../assertions/http.assertions';

import {
  CommentsTestContext,
  CommentWorkspaceActors,
  createCommentsTestContext,
  loadCommentWorkspaceActors,
  seedComment,
  seedStandardCommentIssue,
  testUsers,
  wipeCommentGraph,
  wipeUsers,
} from './comment.controller.fixtures';
import {
  expectCommentCountOnIssue,
  expectCommentListResponse,
  expectCommentPersisted,
  expectCommentResource,
  expectCommentStillExists,
  expectNoCommentsOnIssue,
  expectNoCommentWithId,
} from './comment.controller.assertions';

const WELL_FORMED_UNKNOWN_UUID = '11111111-1111-4111-8111-111111111111';
const WELL_FORMED_UNKNOWN_UUID_2 = '22222222-2222-4222-8222-222222222222';

describe('Comments Controller', () => {
  let app: Application;
  let ctx: CommentsTestContext;

  beforeAll(async () => {
    ctx = createCommentsTestContext();
    app = ctx.app;

    await ensureWorkspaceRolesSeeded();
    await ensureProjectRolesSeeded();
  });

  describe('POST /', () => {
    let actors: CommentWorkspaceActors;
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    let issueId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      actors = await loadCommentWorkspaceActors();
      workspaceOwnerActor = actors.workspaceOwnerActor;
      workspaceAdminActor = actors.workspaceAdminActor;
      workspaceDeveloperActor = actors.workspaceDeveloperActor;
    });

    afterAll(async () => {
      await wipeCommentGraph();
      await wipeUsers();
    });

    beforeEach(async () => {
      await wipeCommentGraph();
      const seeded = await seedStandardCommentIssue(actors);
      projectId = seeded.projectId;
      issueId = seeded.issueId;
      projectOwnerActor = seeded.projectOwnerActor;
      projectAdminActor = seeded.projectAdminActor;
      projectDeveloperActor = seeded.projectDeveloperActor;
    });

    function createCommentRequest(
      pathProjectId: string,
      pathIssueId: string,
      body: Record<string, unknown> | undefined | unknown[],
      authorizationHeader?: string,
    ) {
      const request = supertest(app).post(
        `/api/v1/projects/${pathProjectId}/issues/${pathIssueId}/comments`,
      );
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request.send(body);
    }

    describe('on success', () => {
      it.each([
        {
          case: 'Workspace Owner without a project role',
          getActor: () => workspaceOwnerActor,
          getRole: () => WorkspaceRoleName.OWNER,
        },
        {
          case: 'Workspace Admin without a project role',
          getActor: () => workspaceAdminActor,
          getRole: () => WorkspaceRoleName.ADMIN,
        },
        {
          case: 'Project Owner member',
          getActor: () => projectOwnerActor,
          getRole: () => WorkspaceRoleName.OWNER,
        },
        {
          case: 'Project Admin member',
          getActor: () => projectAdminActor,
          getRole: () => WorkspaceRoleName.ADMIN,
        },
        {
          case: 'Developer member',
          getActor: () => projectDeveloperActor,
          getRole: () => WorkspaceRoleName.DEVELOPER,
        },
      ])('creates a comment attributed to $case', async ({ getActor, getRole }) => {
        const actor = getActor();
        const actorEmail = requireTestUser(testUsers, getRole()).email;
        const actorName = requireTestUser(testUsers, getRole()).name;

        const response = await createCommentRequest(
          projectId,
          issueId,
          { body: 'Nice work on this one.' },
          tokenFor(ctx.tokenService, actor),
        );

        expectCommentResource(response, 201, {
          body: 'Nice work on this one.',
          issueId,
          creator: { id: actor.userId, name: actorName, email: actorEmail },
        });

        await expectCommentPersisted(response.body.data.id, {
          issueId,
          creatorId: actor.userId,
          body: 'Nice work on this one.',
        });
      });
    });

    describe('on validation failure (400)', () => {
      it.each<{
        case: string;
        body: Record<string, unknown> | undefined | unknown[];
        expectedFields: string[];
      }>([
        { case: 'body is missing', body: {}, expectedFields: ['body'] },
        { case: 'body is empty', body: { body: '' }, expectedFields: ['body'] },
        { case: 'body is the wrong type', body: { body: 42 }, expectedFields: ['body'] },
        { case: 'body is null', body: { body: null }, expectedFields: ['body'] },
        {
          case: 'an extra field is present',
          body: { body: 'ok', foo: 'bar' },
          expectedFields: ['foo'],
        },
        { case: 'body is undefined', body: undefined, expectedFields: ['body'] },
        { case: 'body is not a plain object', body: [], expectedFields: ['body'] },
      ])('returns a validation error when $case', async ({ body, expectedFields }) => {
        const response = await createCommentRequest(
          projectId,
          issueId,
          body,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, expectedFields);
        await expectNoCommentsOnIssue(issueId);
      });

      it('returns a validation error when the path projectId is not a uuid', async () => {
        const response = await createCommentRequest(
          'not-a-uuid',
          issueId,
          { body: 'ok' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['projectId']);
        await expectNoCommentsOnIssue(issueId);
      });

      it('returns a validation error when the path issueId is not a uuid', async () => {
        const response = await createCommentRequest(
          projectId,
          'not-a-uuid',
          { body: 'ok' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['issueId']);
        await expectNoCommentsOnIssue(issueId);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and creates nothing', async () => {
        const response = await createCommentRequest(projectId, issueId, { body: 'ok' });

        expectAuthenticationRequired(response);
        await expectNoCommentsOnIssue(issueId);
      });
    });

    describe('on authorization failures (403)', () => {
      it('returns a forbidden error for a Developer with no project role on the target', async () => {
        // The seeded membership makes workspaceDeveloperActor a Developer member.
        // Remove that membership so the role check fails cleanly.
        await prisma.projectMember.deleteMany({
          where: { projectId, userId: workspaceDeveloperActor.userId },
        });

        const response = await createCommentRequest(
          projectId,
          issueId,
          { body: 'ok' },
          tokenFor(ctx.tokenService, workspaceDeveloperActor),
        );

        expectForbiddenError(response);
        await expectNoCommentsOnIssue(issueId);
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown issue id under a valid projectId', async () => {
        const response = await createCommentRequest(
          projectId,
          WELL_FORMED_UNKNOWN_UUID,
          { body: 'ok' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.issueRepository.resourceName);
        await expectNoCommentsOnIssue(issueId);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when the comment repository createComment throws', async () => {
        jest
          .spyOn(ctx.commentRepository, 'createComment')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await createCommentRequest(
          projectId,
          issueId,
          { body: 'ok' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectInternalServerError(response);
        await expectNoCommentsOnIssue(issueId);
      });
    });
  });

  describe('GET /', () => {
    let actors: CommentWorkspaceActors;
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;
    let nonMemberDeveloperActor: ActorContext;

    let projectId: string;
    let issueId: string;
    let otherIssueId: string;

    let firstCommentId: string;
    let secondCommentId: string;
    let thirdCommentId: string;

    beforeAll(async () => {
      await wipeCommentGraph();
      await wipeUsers();

      await createTestUsers(testUsers);
      actors = await loadCommentWorkspaceActors();
      workspaceOwnerActor = actors.workspaceOwnerActor;
      workspaceAdminActor = actors.workspaceAdminActor;
      workspaceDeveloperActor = actors.workspaceDeveloperActor;

      // Extra non-member developer for the 403 case.
      const nonMemberDeveloper = await prisma.user.create({
        data: {
          name: 'Non-member Dev',
          email: 'comments-list-nonmember@example.com',
          password: 'x',
          status: 'Active',
          workspaceRoleId: workspaceDeveloperActor.workspaceRole.id,
        },
      });

      const seeded = await seedStandardCommentIssue(actors);
      projectId = seeded.projectId;
      issueId = seeded.issueId;
      projectOwnerActor = seeded.projectOwnerActor;
      projectAdminActor = seeded.projectAdminActor;
      projectDeveloperActor = seeded.projectDeveloperActor;

      nonMemberDeveloperActor = userToActorContext(
        {
          id: nonMemberDeveloper.id,
          workspaceRoleId: nonMemberDeveloper.workspaceRoleId,
          workspaceRoleName: WorkspaceRoleName.DEVELOPER,
        },
        [],
      );

      // Seed 3 comments on the target issue, in a non-chronological insertion
      // order (sleep-free: Prisma rows will still get strictly increasing
      // createdAt timestamps that we then overwrite deterministically below).
      const first = await seedComment({
        issueId,
        creatorId: workspaceOwnerActor.userId,
        body: 'first',
      });
      const second = await seedComment({
        issueId,
        creatorId: workspaceAdminActor.userId,
        body: 'second',
      });
      const third = await seedComment({
        issueId,
        creatorId: workspaceDeveloperActor.userId,
        body: 'third',
      });

      // Pin deterministic createdAt timestamps so oldest-first ordering is
      // observable regardless of how the DB scheduled the inserts above.
      await prisma.comment.update({
        where: { id: first.id },
        data: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
      });
      await prisma.comment.update({
        where: { id: second.id },
        data: { createdAt: new Date('2026-01-02T00:00:00.000Z') },
      });
      await prisma.comment.update({
        where: { id: third.id },
        data: { createdAt: new Date('2026-01-03T00:00:00.000Z') },
      });

      firstCommentId = first.id;
      secondCommentId = second.id;
      thirdCommentId = third.id;

      // Seed a cross-issue comment on a different issue to prove scoping.
      const otherIssue = await prisma.issue.create({
        data: {
          projectId,
          creatorId: workspaceOwnerActor.userId,
          assigneeId: workspaceOwnerActor.userId,
          title: 'Other issue',
          description: 'other desc',
          status: 'ToDo',
          priority: 'Medium',
        },
        select: { id: true },
      });
      otherIssueId = otherIssue.id;
      await seedComment({
        issueId: otherIssueId,
        creatorId: workspaceOwnerActor.userId,
        body: 'cross-issue comment',
      });
    });

    afterAll(async () => {
      await wipeCommentGraph();
      await wipeUsers();
    });

    function listCommentsRequest(
      pathProjectId: string,
      pathIssueId: string,
      authorizationHeader?: string,
    ) {
      const request = supertest(app).get(
        `/api/v1/projects/${pathProjectId}/issues/${pathIssueId}/comments`,
      );
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request;
    }

    describe('on success', () => {
      it.each([
        { case: 'Workspace Owner (bypass)', getActor: () => workspaceOwnerActor },
        { case: 'Workspace Admin (bypass)', getActor: () => workspaceAdminActor },
        { case: 'Project Owner member', getActor: () => projectOwnerActor },
        { case: 'Project Admin member', getActor: () => projectAdminActor },
        { case: 'Developer member', getActor: () => projectDeveloperActor },
      ])(
        "returns the issue's comments oldest-first and scoped to the issue for a $case",
        async ({ getActor }) => {
          const ownerUser = requireTestUser(testUsers, WorkspaceRoleName.OWNER);
          const adminUser = requireTestUser(testUsers, WorkspaceRoleName.ADMIN);
          const devUser = requireTestUser(testUsers, WorkspaceRoleName.DEVELOPER);

          const response = await listCommentsRequest(
            projectId,
            issueId,
            tokenFor(ctx.tokenService, getActor()),
          );

          expectCommentListResponse(response, [
            {
              id: firstCommentId,
              body: 'first',
              issueId,
              creator: {
                id: workspaceOwnerActor.userId,
                name: ownerUser.name,
                email: ownerUser.email,
              },
            },
            {
              id: secondCommentId,
              body: 'second',
              issueId,
              creator: {
                id: workspaceAdminActor.userId,
                name: adminUser.name,
                email: adminUser.email,
              },
            },
            {
              id: thirdCommentId,
              body: 'third',
              issueId,
              creator: {
                id: workspaceDeveloperActor.userId,
                name: devUser.name,
                email: devUser.email,
              },
            },
          ]);
        },
      );
    });

    describe('on validation failure (400)', () => {
      it('returns a validation error when the path projectId is not a uuid', async () => {
        const response = await listCommentsRequest(
          'not-a-uuid',
          issueId,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['projectId']);
      });

      it('returns a validation error when the path issueId is not a uuid', async () => {
        const response = await listCommentsRequest(
          projectId,
          'not-a-uuid',
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['issueId']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error', async () => {
        const response = await listCommentsRequest(projectId, issueId);

        expectAuthenticationRequired(response);
      });
    });

    describe('on authorization failures (403)', () => {
      it('returns a forbidden error for a Developer with no project role on the target', async () => {
        const response = await listCommentsRequest(
          projectId,
          issueId,
          tokenFor(ctx.tokenService, nonMemberDeveloperActor),
        );

        expectForbiddenError(response);
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown issue id under a valid projectId', async () => {
        const response = await listCommentsRequest(
          projectId,
          WELL_FORMED_UNKNOWN_UUID,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.issueRepository.resourceName);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when the comment repository getCommentsByIssueId throws', async () => {
        jest
          .spyOn(ctx.commentRepository, 'getCommentsByIssueId')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await listCommentsRequest(
          projectId,
          issueId,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectInternalServerError(response);
      });
    });
  });

  describe('DELETE /:commentId', () => {
    let actors: CommentWorkspaceActors;
    let workspaceDeveloperActor: ActorContext;

    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    let issueId: string;
    let ownCommentId: string;
    let othersCommentId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      actors = await loadCommentWorkspaceActors();
      workspaceDeveloperActor = actors.workspaceDeveloperActor;
    });

    afterAll(async () => {
      await wipeCommentGraph();
      await wipeUsers();
    });

    beforeEach(async () => {
      await wipeCommentGraph();
      const seeded = await seedStandardCommentIssue(actors);
      projectId = seeded.projectId;
      issueId = seeded.issueId;
      projectAdminActor = seeded.projectAdminActor;
      projectDeveloperActor = seeded.projectDeveloperActor;

      // The Developer actor authors `ownCommentId` so that removing their
      // project membership strips every authorization path (there is no
      // workspace bypass for the workspace Developer role).
      const own = await seedComment({
        issueId,
        creatorId: projectDeveloperActor.userId,
        body: "actor's own comment",
      });
      const others = await seedComment({
        issueId,
        creatorId: projectAdminActor.userId,
        body: "someone else's comment",
      });
      ownCommentId = own.id;
      othersCommentId = others.id;
    });

    function deleteCommentRequest(
      pathProjectId: string,
      pathIssueId: string,
      pathCommentId: string,
      authorizationHeader?: string,
    ) {
      const request = supertest(app).delete(
        `/api/v1/projects/${pathProjectId}/issues/${pathIssueId}/comments/${pathCommentId}`,
      );
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request;
    }

    describe('on success', () => {
      it('deletes the actor own comment and returns 204', async () => {
        const response = await deleteCommentRequest(
          projectId,
          issueId,
          ownCommentId,
          tokenFor(ctx.tokenService, projectDeveloperActor),
        );

        expectNoContentResponse(response);
        await expectNoCommentWithId(ownCommentId);
        // The other user's comment must remain.
        await expectCommentStillExists(othersCommentId);
      });
    });

    describe('on validation failure (400)', () => {
      it('returns a validation error when the path projectId is not a uuid', async () => {
        const response = await deleteCommentRequest(
          'not-a-uuid',
          issueId,
          ownCommentId,
          tokenFor(ctx.tokenService, projectDeveloperActor),
        );

        expectValidationError(response, ['projectId']);
        await expectCommentStillExists(ownCommentId);
      });

      it('returns a validation error when the path issueId is not a uuid', async () => {
        const response = await deleteCommentRequest(
          projectId,
          'not-a-uuid',
          ownCommentId,
          tokenFor(ctx.tokenService, projectDeveloperActor),
        );

        expectValidationError(response, ['issueId']);
        await expectCommentStillExists(ownCommentId);
      });

      it('returns a validation error when the path commentId is not a uuid', async () => {
        const response = await deleteCommentRequest(
          projectId,
          issueId,
          'not-a-uuid',
          tokenFor(ctx.tokenService, projectDeveloperActor),
        );

        expectValidationError(response, ['commentId']);
        await expectCommentStillExists(ownCommentId);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and does not delete', async () => {
        const response = await deleteCommentRequest(projectId, issueId, ownCommentId);

        expectAuthenticationRequired(response);
        await expectCommentStillExists(ownCommentId);
      });
    });

    describe('on authorization failures (403)', () => {
      it("returns a forbidden error when a viewer tries to delete another user's comment and leaves it unchanged", async () => {
        const response = await deleteCommentRequest(
          projectId,
          issueId,
          othersCommentId,
          tokenFor(ctx.tokenService, projectDeveloperActor),
        );

        expectForbiddenError(response);
        await expectCommentStillExists(othersCommentId);
      });

      it('returns a forbidden error when the comment author has lost project access and leaves the comment unchanged', async () => {
        // The workspace Developer actor authored `ownCommentId`. Remove their
        // project membership — they have no workspace Owner/Admin bypass, so
        // the role check now fails before ownership is considered.
        await prisma.projectMember.deleteMany({
          where: { projectId, userId: projectDeveloperActor.userId },
        });

        const response = await deleteCommentRequest(
          projectId,
          issueId,
          ownCommentId,
          tokenFor(ctx.tokenService, workspaceDeveloperActor),
        );

        expectForbiddenError(response);
        await expectCommentStillExists(ownCommentId);
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown issue id under a valid projectId', async () => {
        const response = await deleteCommentRequest(
          projectId,
          WELL_FORMED_UNKNOWN_UUID,
          ownCommentId,
          tokenFor(ctx.tokenService, projectDeveloperActor),
        );

        expectResourceNotFoundError(response, ctx.issueRepository.resourceName);
        await expectCommentStillExists(ownCommentId);
      });

      it('returns a not-found error for an unknown commentId on the issue', async () => {
        const response = await deleteCommentRequest(
          projectId,
          issueId,
          WELL_FORMED_UNKNOWN_UUID_2,
          tokenFor(ctx.tokenService, projectDeveloperActor),
        );

        expectResourceNotFoundError(response, ctx.commentRepository.resourceName);
        await expectCommentCountOnIssue(issueId, 2);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when getCommentById throws', async () => {
        jest
          .spyOn(ctx.commentRepository, 'getCommentById')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await deleteCommentRequest(
          projectId,
          issueId,
          ownCommentId,
          tokenFor(ctx.tokenService, projectDeveloperActor),
        );

        expectInternalServerError(response);
        await expectCommentStillExists(ownCommentId);
      });

      it('returns an internal server error when deleteComment throws', async () => {
        jest
          .spyOn(ctx.commentRepository, 'deleteComment')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await deleteCommentRequest(
          projectId,
          issueId,
          ownCommentId,
          tokenFor(ctx.tokenService, projectDeveloperActor),
        );

        expectInternalServerError(response);
        await expectCommentStillExists(ownCommentId);
      });
    });
  });
});
