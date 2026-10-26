import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import supertest from 'supertest';

import { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { prisma } from '@/common/lib/prisma';
import { ProjectRoleName } from '@/modules/project-roles';
import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { IssuePriority, IssueStatus } from '@/modules/issues';

import { createTestUsers } from '../../fixtures/users.fixtures';
import { ensureWorkspaceRolesSeeded } from '../../fixtures/workspace-roles.fixtures';
import { ensureProjectRolesSeeded } from '../../fixtures/project-roles.fixtures';
import { seedProject } from '../../fixtures/projects.fixtures';
import {
  requireTestUser,
  tokenFor,
  userToActorContext,
} from '../../fixtures/actor-context.fixtures';

import {
  expectAuthenticationRequired,
  expectBusinessRuleViolationError,
  expectForbiddenError,
  expectInternalServerError,
  expectResourceNotFoundError,
  expectValidationError,
} from '../../assertions/errors.assertions';

import { describeListEndpoint } from '../../suites/list-endpoint.suite';

import {
  createIssuesTestContext,
  IssuesTestContext,
  IssueWorkspaceActors,
  loadIssueWorkspaceActors,
  seedIssue,
  seedStandardIssueProject,
  SeededIssue,
  testUsers,
  wipeIssueGraph,
  wipeUsers,
} from './issue.controller.fixtures';
import {
  expectIssuePersisted,
  expectIssueResource,
  expectIssueStillExists,
  expectIssueUnchanged,
  expectNoContentResponse,
  expectNoIssuesInProject,
  expectNoIssueWithId,
} from './issue.controller.assertions';

const WELL_FORMED_UNKNOWN_UUID = '11111111-1111-4111-8111-111111111111';
const WELL_FORMED_UNKNOWN_UUID_2 = '22222222-2222-4222-8222-222222222222';

const ORIGINAL_ISSUE = {
  title: 'Original title',
  description: 'Original desc',
  status: IssueStatus.ToDo,
  priority: IssuePriority.Medium,
} as const;

describe('Issues Controller', () => {
  let app: Application;
  let ctx: IssuesTestContext;

  beforeAll(async () => {
    ctx = createIssuesTestContext();
    app = ctx.app;

    await ensureWorkspaceRolesSeeded();
    await ensureProjectRolesSeeded();
  });

  describe('POST /', () => {
    let actors: IssueWorkspaceActors;
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    let projectOwnerRoleId: string;
    let memberAssigneeUserId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      actors = await loadIssueWorkspaceActors();
      workspaceOwnerActor = actors.workspaceOwnerActor;
      workspaceAdminActor = actors.workspaceAdminActor;
      workspaceDeveloperActor = actors.workspaceDeveloperActor;
      projectOwnerRoleId = actors.projectOwnerRoleId;
      memberAssigneeUserId = actors.memberAssigneeUserId;
    });

    afterAll(async () => {
      await wipeIssueGraph();
      await wipeUsers();
    });

    beforeEach(async () => {
      await wipeIssueGraph();
      const seeded = await seedStandardIssueProject(actors);
      projectId = seeded.projectId;
      projectOwnerActor = seeded.projectOwnerActor;
      projectAdminActor = seeded.projectAdminActor;
      projectDeveloperActor = seeded.projectDeveloperActor;
    });

    function createIssueRequest(
      pathProjectId: string,
      body: Record<string, unknown> | undefined | unknown[],
      authorizationHeader?: string,
    ) {
      const request = supertest(app).post(`/api/v1/projects/${pathProjectId}/issues`);
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request.send(body);
    }

    describe('on success', () => {
      it.each([
        { case: 'Project Owner', getActor: () => projectOwnerActor },
        { case: 'Project Admin', getActor: () => projectAdminActor },
        { case: 'Developer', getActor: () => projectDeveloperActor },
      ])(
        'creates an issue with defaults applied when $case submits only title and description',
        async ({ getActor }) => {
          const actor = getActor();
          const actorEmail = requireTestUser(testUsers, actor.workspaceRole.name).email;
          const actorName = requireTestUser(testUsers, actor.workspaceRole.name).name;

          const response = await createIssueRequest(
            projectId,
            { title: 'Login crashes', description: 'Reproduces on prod' },
            tokenFor(ctx.tokenService, actor),
          );

          expectIssueResource(response, 201, {
            title: 'Login crashes',
            description: 'Reproduces on prod',
            status: IssueStatus.ToDo,
            priority: IssuePriority.Medium,
            projectId,
            creator: { id: actor.userId, name: actorName, email: actorEmail },
            assignee: { id: actor.userId, name: actorName, email: actorEmail },
          });

          await expectIssuePersisted(response.body.data.id, {
            projectId,
            creatorId: actor.userId,
            assigneeId: actor.userId,
            title: 'Login crashes',
            description: 'Reproduces on prod',
            status: IssueStatus.ToDo,
            priority: IssuePriority.Medium,
          });
        },
      );

      it('honors an explicit priority when supplied', async () => {
        const ownerUser = requireTestUser(testUsers, WorkspaceRoleName.OWNER);

        const response = await createIssueRequest(
          projectId,
          { title: 'High-pri', description: 'High priority task', priority: IssuePriority.High },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectIssueResource(response, 201, {
          title: 'High-pri',
          description: 'High priority task',
          status: IssueStatus.ToDo,
          priority: IssuePriority.High,
          projectId,
          creator: {
            id: projectOwnerActor.userId,
            name: ownerUser.name,
            email: ownerUser.email,
          },
          assignee: {
            id: projectOwnerActor.userId,
            name: ownerUser.name,
            email: ownerUser.email,
          },
        });

        await expectIssuePersisted(response.body.data.id, {
          projectId,
          creatorId: projectOwnerActor.userId,
          assigneeId: projectOwnerActor.userId,
          title: 'High-pri',
          description: 'High priority task',
          status: IssueStatus.ToDo,
          priority: IssuePriority.High,
        });
      });

      it('honors an explicit assigneeId referencing another project member', async () => {
        const ownerUser = requireTestUser(testUsers, WorkspaceRoleName.OWNER);
        const adminUser = requireTestUser(testUsers, WorkspaceRoleName.ADMIN);

        const response = await createIssueRequest(
          projectId,
          {
            title: 'Assign to admin',
            description: 'Assigns to the project admin',
            assigneeId: memberAssigneeUserId,
          },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectIssueResource(response, 201, {
          title: 'Assign to admin',
          description: 'Assigns to the project admin',
          status: IssueStatus.ToDo,
          priority: IssuePriority.Medium,
          projectId,
          creator: {
            id: projectOwnerActor.userId,
            name: ownerUser.name,
            email: ownerUser.email,
          },
          assignee: {
            id: memberAssigneeUserId,
            name: adminUser.name,
            email: adminUser.email,
          },
        });

        await expectIssuePersisted(response.body.data.id, {
          projectId,
          creatorId: projectOwnerActor.userId,
          assigneeId: memberAssigneeUserId,
          title: 'Assign to admin',
          description: 'Assigns to the project admin',
          status: IssueStatus.ToDo,
          priority: IssuePriority.Medium,
        });
      });
    });

    describe('on validation failure (400)', () => {
      it.each<{
        case: string;
        body: Record<string, unknown> | undefined | unknown[];
        expectedFields: string[];
      }>([
        {
          case: 'title is missing',
          body: { description: 'desc' },
          expectedFields: ['title'],
        },
        {
          case: 'description is missing',
          body: { title: 'title' },
          expectedFields: ['description'],
        },
        {
          case: 'title is empty',
          body: { title: '', description: 'desc' },
          expectedFields: ['title'],
        },
        {
          case: 'description is empty',
          body: { title: 'title', description: '' },
          expectedFields: ['description'],
        },
        {
          case: 'assigneeId is malformed',
          body: { title: 't', description: 'd', assigneeId: 'not-a-uuid' },
          expectedFields: ['assigneeId'],
        },
        {
          case: 'priority value is unknown',
          body: { title: 't', description: 'd', priority: 'URGENT' },
          expectedFields: ['priority'],
        },
        {
          case: 'status is present in the body (always rejected)',
          body: { title: 't', description: 'd', status: IssueStatus.ToDo },
          expectedFields: ['status'],
        },
        {
          case: 'an extra field is present',
          body: { title: 't', description: 'd', foo: 'bar' },
          expectedFields: ['foo'],
        },
        {
          case: 'body is undefined',
          body: undefined,
          expectedFields: ['title', 'description'],
        },
        {
          case: 'body is not a plain object',
          body: [],
          expectedFields: ['title', 'description'],
        },
      ])('returns a validation error when $case', async ({ body, expectedFields }) => {
        const response = await createIssueRequest(
          projectId,
          body,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, expectedFields);
        await expectNoIssuesInProject(projectId);
      });

      it('returns a validation error when the path projectId is not a uuid', async () => {
        const response = await createIssueRequest(
          'not-a-uuid',
          { title: 't', description: 'd' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['projectId']);
        await expectNoIssuesInProject(projectId);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and creates nothing', async () => {
        const response = await createIssueRequest(projectId, {
          title: 't',
          description: 'd',
        });

        expectAuthenticationRequired(response);
        await expectNoIssuesInProject(projectId);
      });
    });

    describe('on authorization failures (403)', () => {
      it.each([
        {
          case: 'Workspace Owner without a project role',
          getActor: () => workspaceOwnerActor,
        },
        {
          case: 'Workspace Admin without a project role',
          getActor: () => workspaceAdminActor,
        },
        {
          case: 'non-member Developer',
          getActor: () => workspaceDeveloperActor,
        },
      ])('returns a forbidden error for a $case', async ({ getActor }) => {
        // The seeded memberships would make these actors members; delete them
        // for this test to simulate the "no project role" branch.
        await prisma.projectMember.deleteMany({ where: { projectId } });

        const response = await createIssueRequest(
          projectId,
          { title: 't', description: 'd' },
          tokenFor(ctx.tokenService, getActor()),
        );

        expectForbiddenError(response);
        await expectNoIssuesInProject(projectId);
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown projectId (authorized via spied project role)', async () => {
        // `createIssue` has no workspace bypass, so to reach the project-existence
        // check with an unknown projectId we must inject a project role on that
        // unknown projectId. Spy on `getProjectMembersByUserId` to shape the
        // actor's project roles at authentication time.
        jest.spyOn(ctx.projectMemberRepository, 'getProjectMembersByUserId').mockResolvedValueOnce([
          {
            id: '00000000-0000-0000-0000-000000000000',
            projectId: WELL_FORMED_UNKNOWN_UUID,
            userId: projectOwnerActor.userId,
            projectRoleId: projectOwnerRoleId,
            projectRole: { id: projectOwnerRoleId, name: ProjectRoleName.PROJECT_OWNER },
          },
        ]);

        const response = await createIssueRequest(
          WELL_FORMED_UNKNOWN_UUID,
          { title: 't', description: 'd' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.projectRepository.resourceName);
        await expectNoIssuesInProject(projectId);
      });
    });

    describe('on business rule violations (422)', () => {
      it('returns 422 when the supplied assigneeId references a user who is not a project member', async () => {
        // Create a user who is NOT a member of the target project.
        const nonMember = await prisma.user.create({
          data: {
            name: 'Non member',
            email: 'issues-nonmember-create@example.com',
            password: 'x',
            status: 'Active',
            workspaceRoleId: workspaceDeveloperActor.workspaceRole.id,
          },
        });

        const response = await createIssueRequest(
          projectId,
          { title: 't', description: 'd', assigneeId: nonMember.id },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await expectNoIssuesInProject(projectId);
      });

      it('returns 422 when the supplied assigneeId references an unknown user id', async () => {
        const response = await createIssueRequest(
          projectId,
          { title: 't', description: 'd', assigneeId: WELL_FORMED_UNKNOWN_UUID_2 },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await expectNoIssuesInProject(projectId);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when the issue repository createIssue throws', async () => {
        jest
          .spyOn(ctx.issueRepository, 'createIssue')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await createIssueRequest(
          projectId,
          { title: 't', description: 'd' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectInternalServerError(response);
        await expectNoIssuesInProject(projectId);
      });
    });
  });

  describe('GET /', () => {
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;
    let nonMemberDeveloperActor: ActorContext;
    // Dedicated default actor for the shared list suite: a Workspace Admin
    // (so workspace-bypass grants read on `listIssues`) who is NOT a project
    // member, so the suite's workspace-role spy to an unknown role name has
    // no project-role branch to fall back to — producing a clean 403.
    let defaultSuiteActor: ActorContext;

    let projectId: string;

    let seededIssues: SeededIssue[];
    const PAGE_SIZE = 3;

    beforeAll(async () => {
      await wipeIssueGraph();
      await wipeUsers();

      await createTestUsers(testUsers);
      const actors = await loadIssueWorkspaceActors();
      workspaceOwnerActor = actors.workspaceOwnerActor;
      workspaceAdminActor = actors.workspaceAdminActor;
      workspaceDeveloperActor = actors.workspaceDeveloperActor;

      // Also seed an additional non-member developer user.
      const nonMemberDeveloper = await prisma.user.create({
        data: {
          name: 'Non Member Dev',
          email: 'issues-list-nonmember@example.com',
          password: 'x',
          status: 'Active',
          workspaceRoleId: workspaceDeveloperActor.workspaceRole.id,
        },
      });

      // Shared-suite default actor: Workspace Admin NOT a project member.
      const defaultSuiteUser = await prisma.user.create({
        data: {
          name: 'List Suite Default',
          email: 'issues-list-default@example.com',
          password: 'x',
          status: 'Active',
          workspaceRoleId: workspaceAdminActor.workspaceRole.id,
        },
      });

      const seeded = await seedStandardIssueProject(actors);
      projectId = seeded.projectId;
      projectOwnerActor = seeded.projectOwnerActor;
      projectAdminActor = seeded.projectAdminActor;
      projectDeveloperActor = seeded.projectDeveloperActor;

      const other = await seedProject(workspaceOwnerActor.userId, 'Other', 'Other desc');

      nonMemberDeveloperActor = userToActorContext(
        {
          id: nonMemberDeveloper.id,
          workspaceRoleId: nonMemberDeveloper.workspaceRoleId,
          workspaceRoleName: WorkspaceRoleName.DEVELOPER,
        },
        [],
      );
      defaultSuiteActor = userToActorContext(
        {
          id: defaultSuiteUser.id,
          workspaceRoleId: defaultSuiteUser.workspaceRoleId,
          workspaceRoleName: WorkspaceRoleName.ADMIN,
        },
        [],
      );

      // Seed 7 issues in the target project with alternating statuses so filter
      // probes have both matching and non-matching rows.
      seededIssues = [];
      for (let i = 0; i < 7; i++) {
        const status =
          i % 3 === 0 ? IssueStatus.ToDo : i % 3 === 1 ? IssueStatus.InProgress : IssueStatus.Done;
        const issue = await seedIssue({
          projectId,
          creatorId: workspaceOwnerActor.userId,
          assigneeId: workspaceOwnerActor.userId,
          title: `Issue ${i}`,
          description: `desc ${i}`,
          status,
          priority: IssuePriority.Medium,
        });
        seededIssues.push(issue);
      }

      // Seed 2 "other-project" issues to prove cross-project scoping excludes them.
      await seedIssue({
        projectId: other.id,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'Other-1',
        description: 'o1',
      });
      await seedIssue({
        projectId: other.id,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'Other-2',
        description: 'o2',
      });
    });

    afterAll(async () => {
      await wipeIssueGraph();
      await wipeUsers();
    });

    function listIssuesRequest(
      pathProjectId: string,
      query?: Record<string, string>,
      authorizationHeader?: string,
    ) {
      const request = supertest(app).get(`/api/v1/projects/${pathProjectId}/issues`);
      if (query !== undefined) {
        request.query(query);
      }
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request;
    }

    describeListEndpoint({
      path: '/api/v1/projects/:projectId/issues',
      getRuntimePath: () => `/api/v1/projects/${projectId}/issues`,
      getApp: () => app,
      getTokenService: () => ctx.tokenService,
      totalItems: 7,
      pageSize: PAGE_SIZE,
      defaults: { page: 1, pageSize: 10 },
      // Default actor is a Workspace Admin who is NOT a project member, so
      // the suite's workspace-role 403 spy actually denies — a project-member
      // actor would still pass via its project-role branch.
      getDefaultActor: () => defaultSuiteActor,
      getAuthorizedActorMatrix: () => [
        {
          label: 'Workspace Owner (bypass)',
          actor: workspaceOwnerActor,
          expectedIds: seededIssues.map((i) => i.id),
        },
        {
          label: 'Workspace Admin (bypass)',
          actor: workspaceAdminActor,
          expectedIds: seededIssues.map((i) => i.id),
        },
        {
          label: 'Project Owner member',
          actor: projectOwnerActor,
          expectedIds: seededIssues.map((i) => i.id),
        },
        {
          label: 'Project Admin member',
          actor: projectAdminActor,
          expectedIds: seededIssues.map((i) => i.id),
        },
        {
          label: 'Developer member',
          actor: projectDeveloperActor,
          expectedIds: seededIssues.map((i) => i.id),
        },
      ],
      getFilterProbe: () => ({
        label: 'filter[status][in] (enum)',
        query: {
          'filter[status][in]': `${IssueStatus.ToDo},${IssueStatus.InProgress}`,
          pageSize: '100',
        },
        expectedIds: seededIssues
          .filter((i) => i.status === IssueStatus.ToDo || i.status === IssueStatus.InProgress)
          .map((i) => i.id),
      }),
      getEmptyEnvelopeQuery: () => ({
        'filter[assigneeId]': WELL_FORMED_UNKNOWN_UUID,
      }),
      getSortProbe: () => ({
        query: { sort: '-createdAt', pageSize: '100' },
        getExpectedIdsInOrder: async () =>
          (
            await prisma.issue.findMany({
              where: { projectId },
              orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
              select: { id: true },
            })
          ).map((r) => r.id),
      }),
      validationProbe: { query: { sort: 'disallowed-field' }, expectedFields: ['sort'] },
      getWorkspaceRoleRepository: () => ctx.workspaceRoleRepository,
      arrangeRepositoryFailure: () => {
        jest
          .spyOn(ctx.issueRepository, 'findIssues')
          .mockRejectedValueOnce(new Error('database unavailable'));
      },
    });

    describe('on cross-project scoping', () => {
      it('excludes issues from other projects and reports the target total', async () => {
        const response = await listIssuesRequest(
          projectId,
          { pageSize: '100' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(seededIssues.length);
        expect(response.body.meta.pagination.totalItems).toBe(seededIssues.length);

        for (const entry of response.body.data) {
          expect(entry.projectId).toBe(projectId);
        }
      });
    });

    describe('on path-param validation (400)', () => {
      it('returns a validation error when the path projectId is not a uuid', async () => {
        const response = await listIssuesRequest(
          'not-a-uuid',
          undefined,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['projectId']);
      });
    });

    describe('on project-scope authorization failure (403)', () => {
      it('returns a forbidden error for a Developer with no project role on the target', async () => {
        const response = await listIssuesRequest(
          projectId,
          undefined,
          tokenFor(ctx.tokenService, nonMemberDeveloperActor),
        );

        expectForbiddenError(response);
      });
    });

    describe('on unknown project (404)', () => {
      it('returns a not-found error for a well-formed but unknown projectId', async () => {
        const response = await listIssuesRequest(
          WELL_FORMED_UNKNOWN_UUID,
          undefined,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.projectRepository.resourceName);
      });
    });

    describe('on response shape', () => {
      it('every list entry carries expanded creator and assignee objects with no raw scalar FKs', async () => {
        const response = await listIssuesRequest(
          projectId,
          { pageSize: '100' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);

        for (const entry of response.body.data) {
          expect(entry.creator).toEqual({
            id: expect.any(String),
            name: expect.any(String),
            email: expect.any(String),
          });
          expect(entry.assignee).toEqual({
            id: expect.any(String),
            name: expect.any(String),
            email: expect.any(String),
          });
          expect(entry.creatorId).toBeUndefined();
          expect(entry.assigneeId).toBeUndefined();
        }
      });
    });
  });

  describe('GET /:id', () => {
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let nonMemberDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    let issueId: string;
    let otherProjectIssueId: string;

    beforeAll(async () => {
      await wipeIssueGraph();
      await wipeUsers();

      await createTestUsers(testUsers);
      const actors = await loadIssueWorkspaceActors();
      workspaceOwnerActor = actors.workspaceOwnerActor;
      workspaceAdminActor = actors.workspaceAdminActor;

      // Create an extra non-member Developer user for the 403 case.
      const nonMemberDeveloper = await prisma.user.create({
        data: {
          name: 'Non-member Dev',
          email: 'issues-getbyid-nonmember@example.com',
          password: 'x',
          status: 'Active',
          workspaceRoleId: actors.workspaceDeveloperActor.workspaceRole.id,
        },
      });
      nonMemberDeveloperActor = userToActorContext(
        {
          id: nonMemberDeveloper.id,
          workspaceRoleId: nonMemberDeveloper.workspaceRoleId,
          workspaceRoleName: WorkspaceRoleName.DEVELOPER,
        },
        [],
      );

      const seeded = await seedStandardIssueProject(actors);
      projectId = seeded.projectId;
      projectOwnerActor = seeded.projectOwnerActor;
      projectAdminActor = seeded.projectAdminActor;
      projectDeveloperActor = seeded.projectDeveloperActor;

      const other = await seedProject(workspaceOwnerActor.userId, 'Other', 'Other desc');
      const targetIssue = await seedIssue({
        projectId,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'The Issue',
        description: 'target desc',
      });
      const otherIssue = await seedIssue({
        projectId: other.id,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'Other Issue',
        description: 'other desc',
      });
      issueId = targetIssue.id;
      otherProjectIssueId = otherIssue.id;
    });

    afterAll(async () => {
      await wipeIssueGraph();
      await wipeUsers();
    });

    function getIssueRequest(
      pathProjectId: string,
      pathIssueId: string,
      authorizationHeader?: string,
    ) {
      const request = supertest(app).get(`/api/v1/projects/${pathProjectId}/issues/${pathIssueId}`);
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
      ])('returns the expanded issue for a $case', async ({ getActor }) => {
        const ownerUser = requireTestUser(testUsers, WorkspaceRoleName.OWNER);
        const response = await getIssueRequest(
          projectId,
          issueId,
          tokenFor(ctx.tokenService, getActor()),
        );

        expectIssueResource(response, 200, {
          id: issueId,
          title: 'The Issue',
          description: 'target desc',
          status: IssueStatus.ToDo,
          priority: IssuePriority.Medium,
          projectId,
          creator: {
            id: workspaceOwnerActor.userId,
            name: ownerUser.name,
            email: ownerUser.email,
          },
          assignee: {
            id: workspaceOwnerActor.userId,
            name: ownerUser.name,
            email: ownerUser.email,
          },
        });
      });
    });

    describe('on validation failure (400)', () => {
      it('returns a validation error when the path projectId is not a uuid', async () => {
        const response = await getIssueRequest(
          'not-a-uuid',
          issueId,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['projectId']);
      });

      it('returns a validation error when the path issue id is not a uuid', async () => {
        const response = await getIssueRequest(
          projectId,
          'not-a-uuid',
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['issueId']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error', async () => {
        const response = await getIssueRequest(projectId, issueId);

        expectAuthenticationRequired(response);
      });
    });

    describe('on authorization failures (403)', () => {
      it('returns a forbidden error for a non-member Developer', async () => {
        const response = await getIssueRequest(
          projectId,
          issueId,
          tokenFor(ctx.tokenService, nonMemberDeveloperActor),
        );

        expectForbiddenError(response);
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown issue id under a valid projectId', async () => {
        const response = await getIssueRequest(
          projectId,
          WELL_FORMED_UNKNOWN_UUID,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.issueRepository.resourceName);
      });

      it('returns 404 (not 403) when the issue id belongs to a different project', async () => {
        const response = await getIssueRequest(
          projectId,
          otherProjectIssueId,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.issueRepository.resourceName);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when the issue repository getIssueById throws', async () => {
        jest
          .spyOn(ctx.issueRepository, 'getIssueById')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await getIssueRequest(
          projectId,
          issueId,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectInternalServerError(response);
      });
    });
  });

  describe('PATCH /:id', () => {
    let actors: IssueWorkspaceActors;
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    let issueId: string;
    let otherProjectIssueId: string;
    let memberAssigneeUserId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      actors = await loadIssueWorkspaceActors();
      workspaceOwnerActor = actors.workspaceOwnerActor;
      workspaceAdminActor = actors.workspaceAdminActor;
      workspaceDeveloperActor = actors.workspaceDeveloperActor;
      memberAssigneeUserId = actors.memberAssigneeUserId;
    });

    afterAll(async () => {
      await wipeIssueGraph();
      await wipeUsers();
    });

    beforeEach(async () => {
      await wipeIssueGraph();
      const seeded = await seedStandardIssueProject(actors);
      projectId = seeded.projectId;
      projectOwnerActor = seeded.projectOwnerActor;
      projectAdminActor = seeded.projectAdminActor;
      projectDeveloperActor = seeded.projectDeveloperActor;

      const other = await seedProject(workspaceOwnerActor.userId, 'Other', 'Other desc');
      const targetIssue = await seedIssue({
        projectId,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: ORIGINAL_ISSUE.title,
        description: ORIGINAL_ISSUE.description,
        status: ORIGINAL_ISSUE.status,
        priority: ORIGINAL_ISSUE.priority,
      });
      const otherIssue = await seedIssue({
        projectId: other.id,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'Other issue',
        description: 'other desc',
      });
      issueId = targetIssue.id;
      otherProjectIssueId = otherIssue.id;
    });

    function patchIssueRequest(
      pathProjectId: string,
      pathIssueId: string,
      body: Record<string, unknown> | undefined | unknown[],
      authorizationHeader?: string,
    ) {
      const request = supertest(app).patch(
        `/api/v1/projects/${pathProjectId}/issues/${pathIssueId}`,
      );
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request.send(body);
    }

    function originalIssueUnchanged() {
      return expectIssueUnchanged(issueId, {
        title: ORIGINAL_ISSUE.title,
        description: ORIGINAL_ISSUE.description,
        status: ORIGINAL_ISSUE.status,
        priority: ORIGINAL_ISSUE.priority,
        assigneeId: workspaceOwnerActor.userId,
      });
    }

    describe('on success', () => {
      it.each([
        { case: 'Project Owner', getActor: () => projectOwnerActor },
        { case: 'Project Admin', getActor: () => projectAdminActor },
        { case: 'Developer', getActor: () => projectDeveloperActor },
      ])('updates any subset of fields for a $case', async ({ getActor }) => {
        const ownerUser = requireTestUser(testUsers, WorkspaceRoleName.OWNER);
        const adminUser = requireTestUser(testUsers, WorkspaceRoleName.ADMIN);

        const response = await patchIssueRequest(
          projectId,
          issueId,
          {
            title: 'New title',
            description: 'New desc',
            status: IssueStatus.InProgress,
            priority: IssuePriority.High,
            assigneeId: memberAssigneeUserId,
          },
          tokenFor(ctx.tokenService, getActor()),
        );

        expectIssueResource(response, 200, {
          id: issueId,
          title: 'New title',
          description: 'New desc',
          status: IssueStatus.InProgress,
          priority: IssuePriority.High,
          projectId,
          creator: {
            id: workspaceOwnerActor.userId,
            name: ownerUser.name,
            email: ownerUser.email,
          },
          assignee: {
            id: memberAssigneeUserId,
            name: adminUser.name,
            email: adminUser.email,
          },
        });

        await expectIssuePersisted(issueId, {
          projectId,
          creatorId: workspaceOwnerActor.userId,
          assigneeId: memberAssigneeUserId,
          title: 'New title',
          description: 'New desc',
          status: IssueStatus.InProgress,
          priority: IssuePriority.High,
        });
      });

      it.each([
        { from: IssueStatus.ToDo, to: IssueStatus.InProgress },
        { from: IssueStatus.InProgress, to: IssueStatus.Done },
        { from: IssueStatus.Done, to: IssueStatus.ToDo },
      ])('allows the any-to-any status transition $from -> $to', async ({ from, to }) => {
        const ownerUser = requireTestUser(testUsers, WorkspaceRoleName.OWNER);
        await prisma.issue.update({ where: { id: issueId }, data: { status: from } });

        const response = await patchIssueRequest(
          projectId,
          issueId,
          { status: to },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectIssueResource(response, 200, {
          id: issueId,
          title: ORIGINAL_ISSUE.title,
          description: ORIGINAL_ISSUE.description,
          status: to,
          priority: ORIGINAL_ISSUE.priority,
          projectId,
          creator: {
            id: workspaceOwnerActor.userId,
            name: ownerUser.name,
            email: ownerUser.email,
          },
          assignee: {
            id: workspaceOwnerActor.userId,
            name: ownerUser.name,
            email: ownerUser.email,
          },
        });

        await expectIssuePersisted(issueId, {
          projectId,
          creatorId: workspaceOwnerActor.userId,
          assigneeId: workspaceOwnerActor.userId,
          title: ORIGINAL_ISSUE.title,
          description: ORIGINAL_ISSUE.description,
          status: to,
          priority: ORIGINAL_ISSUE.priority,
        });
      });

      it('preserves a stale assignee when the PATCH does not include assigneeId', async () => {
        const ownerUser = requireTestUser(testUsers, WorkspaceRoleName.OWNER);
        const adminUser = requireTestUser(testUsers, WorkspaceRoleName.ADMIN);

        // Make the assignee stale: assign to the project admin, then remove them.
        await prisma.issue.update({
          where: { id: issueId },
          data: { assigneeId: memberAssigneeUserId },
        });
        await prisma.projectMember.deleteMany({
          where: { projectId, userId: memberAssigneeUserId },
        });

        const response = await patchIssueRequest(
          projectId,
          issueId,
          { title: 'Updated' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectIssueResource(response, 200, {
          id: issueId,
          title: 'Updated',
          description: ORIGINAL_ISSUE.description,
          status: ORIGINAL_ISSUE.status,
          priority: ORIGINAL_ISSUE.priority,
          projectId,
          creator: {
            id: workspaceOwnerActor.userId,
            name: ownerUser.name,
            email: ownerUser.email,
          },
          assignee: {
            id: memberAssigneeUserId,
            name: adminUser.name,
            email: adminUser.email,
          },
        });

        await expectIssuePersisted(issueId, {
          projectId,
          creatorId: workspaceOwnerActor.userId,
          assigneeId: memberAssigneeUserId,
          title: 'Updated',
          description: ORIGINAL_ISSUE.description,
          status: ORIGINAL_ISSUE.status,
          priority: ORIGINAL_ISSUE.priority,
        });
      });
    });

    describe('on validation failure (400)', () => {
      it.each<{
        case: string;
        body: Record<string, unknown> | undefined | unknown[];
        expectedFields?: string[];
      }>([
        { case: 'empty body (no fields)', body: {} },
        {
          case: 'empty title',
          body: { title: '' },
          expectedFields: ['title'],
        },
        {
          case: 'empty description',
          body: { description: '' },
          expectedFields: ['description'],
        },
        {
          case: 'unknown status value',
          body: { status: 'Unknown' },
          expectedFields: ['status'],
        },
        {
          case: 'unknown priority value',
          body: { priority: 'URGENT' },
          expectedFields: ['priority'],
        },
        {
          case: 'malformed assigneeId',
          body: { assigneeId: 'not-a-uuid' },
          expectedFields: ['assigneeId'],
        },
        {
          case: 'extra field',
          body: { title: 't', foo: 'bar' },
          expectedFields: ['foo'],
        },
        { case: 'body is not a plain object', body: [] },
      ])('returns a validation error when $case', async ({ body, expectedFields }) => {
        const response = await patchIssueRequest(
          projectId,
          issueId,
          body,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        if (expectedFields) {
          expectValidationError(response, expectedFields);
        } else {
          expectValidationError(response);
        }

        await originalIssueUnchanged();
      });

      it('returns a validation error when the path projectId is not a uuid', async () => {
        const response = await patchIssueRequest(
          'not-a-uuid',
          issueId,
          { title: 't' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['projectId']);
        await originalIssueUnchanged();
      });

      it('returns a validation error when the path issue id is not a uuid', async () => {
        const response = await patchIssueRequest(
          projectId,
          'not-a-uuid',
          { title: 't' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['issueId']);
        await originalIssueUnchanged();
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and does not modify the issue', async () => {
        const response = await patchIssueRequest(projectId, issueId, { title: 'x' });

        expectAuthenticationRequired(response);
        await originalIssueUnchanged();
      });
    });

    describe('on authorization failures (403)', () => {
      it.each([
        { case: 'Workspace Owner without a project role', getActor: () => workspaceOwnerActor },
        { case: 'Workspace Admin without a project role', getActor: () => workspaceAdminActor },
        { case: 'non-member Developer', getActor: () => workspaceDeveloperActor },
      ])('returns a forbidden error for a $case', async ({ getActor }) => {
        // Remove the actor's membership for this test.
        await prisma.projectMember.deleteMany({
          where: { projectId, userId: getActor().userId },
        });

        const response = await patchIssueRequest(
          projectId,
          issueId,
          { title: 'x' },
          tokenFor(ctx.tokenService, getActor()),
        );

        expectForbiddenError(response);
        await originalIssueUnchanged();
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown issue id under a valid projectId', async () => {
        const response = await patchIssueRequest(
          projectId,
          WELL_FORMED_UNKNOWN_UUID,
          { title: 't' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.issueRepository.resourceName);
        await originalIssueUnchanged();
      });

      it('returns 404 and does not modify the issue when it belongs to a different project', async () => {
        const response = await patchIssueRequest(
          projectId,
          otherProjectIssueId,
          { title: 'cross-project' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.issueRepository.resourceName);

        const other = await prisma.issue.findUnique({ where: { id: otherProjectIssueId } });
        expect(other?.title).toBe('Other issue');
      });
    });

    describe('on business rule violations (422)', () => {
      it('returns 422 when the supplied assigneeId references a user who is not a project member', async () => {
        const nonMember = await prisma.user.create({
          data: {
            name: 'Non member',
            email: 'issues-nonmember-patch@example.com',
            password: 'x',
            status: 'Active',
            workspaceRoleId: workspaceDeveloperActor.workspaceRole.id,
          },
        });

        const response = await patchIssueRequest(
          projectId,
          issueId,
          { assigneeId: nonMember.id },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await originalIssueUnchanged();
      });

      it('returns 422 when the supplied assigneeId references an unknown user id', async () => {
        const response = await patchIssueRequest(
          projectId,
          issueId,
          { assigneeId: WELL_FORMED_UNKNOWN_UUID },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await originalIssueUnchanged();
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when the issue repository updateIssue throws', async () => {
        jest
          .spyOn(ctx.issueRepository, 'updateIssue')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await patchIssueRequest(
          projectId,
          issueId,
          { title: 't' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectInternalServerError(response);
        await originalIssueUnchanged();
      });
    });
  });

  describe('DELETE /:id', () => {
    let actors: IssueWorkspaceActors;
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    let issueId: string;
    let otherProjectIssueId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      actors = await loadIssueWorkspaceActors();
      workspaceOwnerActor = actors.workspaceOwnerActor;
      workspaceAdminActor = actors.workspaceAdminActor;
      workspaceDeveloperActor = actors.workspaceDeveloperActor;
    });

    afterAll(async () => {
      await wipeIssueGraph();
      await wipeUsers();
    });

    beforeEach(async () => {
      await wipeIssueGraph();
      const seeded = await seedStandardIssueProject(actors);
      projectId = seeded.projectId;
      projectOwnerActor = seeded.projectOwnerActor;
      projectAdminActor = seeded.projectAdminActor;
      projectDeveloperActor = seeded.projectDeveloperActor;

      const other = await seedProject(workspaceOwnerActor.userId, 'Other', 'Other desc');
      const targetIssue = await seedIssue({
        projectId,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'Target issue',
        description: 'desc',
      });
      const otherIssue = await seedIssue({
        projectId: other.id,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'Other issue',
        description: 'other desc',
      });
      issueId = targetIssue.id;
      otherProjectIssueId = otherIssue.id;
    });

    function deleteIssueRequest(
      pathProjectId: string,
      pathIssueId: string,
      authorizationHeader?: string,
    ) {
      const request = supertest(app).delete(
        `/api/v1/projects/${pathProjectId}/issues/${pathIssueId}`,
      );
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request;
    }

    describe('on success', () => {
      it.each([
        { case: 'Project Owner', getActor: () => projectOwnerActor },
        { case: 'Project Admin', getActor: () => projectAdminActor },
        { case: 'Developer', getActor: () => projectDeveloperActor },
      ])('deletes the issue and returns 204 when $case', async ({ getActor }) => {
        const response = await deleteIssueRequest(
          projectId,
          issueId,
          tokenFor(ctx.tokenService, getActor()),
        );

        expectNoContentResponse(response);
        await expectNoIssueWithId(issueId);
      });

      it('cascades the delete to the issue subtasks', async () => {
        // Seed two subtasks referencing the issue.
        await prisma.subtask.createMany({
          data: [
            {
              title: 's1',
              description: 's1 desc',
              status: IssueStatus.ToDo,
              creatorId: workspaceOwnerActor.userId,
              assigneeId: workspaceOwnerActor.userId,
              issueId,
            },
            {
              title: 's2',
              description: 's2 desc',
              status: IssueStatus.ToDo,
              creatorId: workspaceOwnerActor.userId,
              assigneeId: workspaceOwnerActor.userId,
              issueId,
            },
          ],
        });

        const response = await deleteIssueRequest(
          projectId,
          issueId,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectNoContentResponse(response);
        await expectNoIssueWithId(issueId);
        const orphanSubtasks = await prisma.subtask.findMany({ where: { issueId } });
        expect(orphanSubtasks).toHaveLength(0);
      });
    });

    describe('on validation failure (400)', () => {
      it('returns a validation error when the path projectId is not a uuid', async () => {
        const response = await deleteIssueRequest(
          'not-a-uuid',
          issueId,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['projectId']);
        await expectIssueStillExists(issueId);
      });

      it('returns a validation error when the path issue id is not a uuid', async () => {
        const response = await deleteIssueRequest(
          projectId,
          'not-a-uuid',
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['issueId']);
        await expectIssueStillExists(issueId);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and does not delete', async () => {
        const response = await deleteIssueRequest(projectId, issueId);

        expectAuthenticationRequired(response);
        await expectIssueStillExists(issueId);
      });
    });

    describe('on authorization failures (403)', () => {
      it.each([
        { case: 'Workspace Owner without a project role', getActor: () => workspaceOwnerActor },
        { case: 'Workspace Admin without a project role', getActor: () => workspaceAdminActor },
        { case: 'non-member Developer', getActor: () => workspaceDeveloperActor },
      ])('returns a forbidden error for a $case', async ({ getActor }) => {
        await prisma.projectMember.deleteMany({
          where: { projectId, userId: getActor().userId },
        });

        const response = await deleteIssueRequest(
          projectId,
          issueId,
          tokenFor(ctx.tokenService, getActor()),
        );

        expectForbiddenError(response);
        await expectIssueStillExists(issueId);
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown issue id under a valid projectId', async () => {
        const response = await deleteIssueRequest(
          projectId,
          WELL_FORMED_UNKNOWN_UUID,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.issueRepository.resourceName);
        await expectIssueStillExists(issueId);
      });

      it('returns 404 and does not delete the issue when it belongs to a different project', async () => {
        const response = await deleteIssueRequest(
          projectId,
          otherProjectIssueId,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.issueRepository.resourceName);
        await expectIssueStillExists(otherProjectIssueId);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when the issue repository deleteIssue throws', async () => {
        jest
          .spyOn(ctx.issueRepository, 'deleteIssue')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await deleteIssueRequest(
          projectId,
          issueId,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectInternalServerError(response);
        await expectIssueStillExists(issueId);
      });
    });
  });
});
