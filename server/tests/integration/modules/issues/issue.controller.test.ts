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
import {
  ensureProjectRolesSeeded,
  fetchProjectRoleIdByName,
} from '../../fixtures/project-roles.fixtures';
import { seedProject } from '../../fixtures/projects.fixtures';
import { seedProjectMembership } from '../../fixtures/project-members.fixtures';
import {
  fetchPersistedUsers,
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
  fetchIssueWithRelations,
  IssuesTestContext,
  seedIssue,
  SeededIssue,
  testUsers,
} from './issue.controller.fixtures';
import {
  expectIssuePersisted,
  expectIssueResource,
  expectIssueUnchanged,
  expectNoContentResponse,
  expectNoIssueWithId,
} from './issue.controller.assertions';

const WELL_FORMED_UNKNOWN_UUID = '11111111-1111-4111-8111-111111111111';
const WELL_FORMED_UNKNOWN_UUID_2 = '22222222-2222-4222-8222-222222222222';

describe('Issues Controller', () => {
  let app: Application;
  let ctx: IssuesTestContext;

  beforeAll(async () => {
    ctx = createIssuesTestContext();
    app = ctx.app;

    await ensureWorkspaceRolesSeeded();
    await ensureProjectRolesSeeded();
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/projects/:projectId/issues
  // -----------------------------------------------------------------------
  describe('POST /', () => {
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    let projectOwnerRoleId: string;
    let developerRoleId: string;
    let projectAdminRoleId: string;

    let memberAssigneeUserId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);

      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      workspaceOwnerActor = userToActorContext(owner, []);
      workspaceAdminActor = userToActorContext(admin, []);
      workspaceDeveloperActor = userToActorContext(developer, []);

      projectOwnerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER);
      projectAdminRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN);
      developerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER);

      memberAssigneeUserId = admin.id;
    });

    afterAll(async () => {
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    beforeEach(async () => {
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();

      const project = await seedProject(workspaceOwnerActor.userId, 'Target', 'Target desc');
      projectId = project.id;

      // Seed memberships: owner, admin, developer each as a member of the project.
      await seedProjectMembership(
        projectId,
        workspaceOwnerActor.userId,
        ProjectRoleName.PROJECT_OWNER,
      );
      await seedProjectMembership(
        projectId,
        workspaceAdminActor.userId,
        ProjectRoleName.PROJECT_ADMIN,
      );
      await seedProjectMembership(
        projectId,
        workspaceDeveloperActor.userId,
        ProjectRoleName.DEVELOPER,
      );

      projectOwnerActor = {
        ...workspaceOwnerActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: projectOwnerRoleId,
            projectRoleName: ProjectRoleName.PROJECT_OWNER,
          },
        ],
      };
      projectAdminActor = {
        ...workspaceAdminActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: projectAdminRoleId,
            projectRoleName: ProjectRoleName.PROJECT_ADMIN,
          },
        ],
      };
      projectDeveloperActor = {
        ...workspaceDeveloperActor,
        projectRoles: [
          { projectId, projectRoleId: developerRoleId, projectRoleName: ProjectRoleName.DEVELOPER },
        ],
      };
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
        const response = await createIssueRequest(
          projectId,
          { title: 'High-pri', description: 'High priority task', priority: IssuePriority.High },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expect(response.status).toBe(201);
        expect(response.body.data.priority).toBe(IssuePriority.High);

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
        const response = await createIssueRequest(
          projectId,
          {
            title: 'Assign to admin',
            description: 'Assigns to the project admin',
            assigneeId: memberAssigneeUserId,
          },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expect(response.status).toBe(201);
        expect(response.body.data.assignee.id).toBe(memberAssigneeUserId);

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
        const issues = await prisma.issue.findMany({ where: { projectId } });
        expect(issues).toHaveLength(0);
      });

      it('returns a validation error when the path projectId is not a uuid', async () => {
        const response = await createIssueRequest(
          'not-a-uuid',
          { title: 't', description: 'd' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['projectId']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and creates nothing', async () => {
        const response = await createIssueRequest(projectId, {
          title: 't',
          description: 'd',
        });

        expectAuthenticationRequired(response);
        const issues = await prisma.issue.findMany({ where: { projectId } });
        expect(issues).toHaveLength(0);
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
        const issues = await prisma.issue.findMany({ where: { projectId } });
        expect(issues).toHaveLength(0);
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
        const issues = await prisma.issue.findMany({ where: { projectId } });
        expect(issues).toHaveLength(0);
      });

      it('returns 422 when the supplied assigneeId references an unknown user id (FK)', async () => {
        const response = await createIssueRequest(
          projectId,
          { title: 't', description: 'd', assigneeId: WELL_FORMED_UNKNOWN_UUID_2 },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        const issues = await prisma.issue.findMany({ where: { projectId } });
        expect(issues).toHaveLength(0);
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
      });
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/projects/:projectId/issues  (list) — via shared suite
  // -----------------------------------------------------------------------
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
    let otherProjectId: string;
    let projectOwnerRoleId: string;
    let projectAdminRoleId: string;
    let developerRoleId: string;

    let seededIssues: SeededIssue[];
    const PAGE_SIZE = 3;

    beforeAll(async () => {
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();

      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      // Also seed an additional non-member developer user.
      const nonMemberDeveloper = await prisma.user.create({
        data: {
          name: 'Non Member Dev',
          email: 'issues-list-nonmember@example.com',
          password: 'x',
          status: 'Active',
          workspaceRoleId: developer.workspaceRoleId,
        },
      });

      // Shared-suite default actor: Workspace Admin NOT a project member.
      const defaultSuiteUser = await prisma.user.create({
        data: {
          name: 'List Suite Default',
          email: 'issues-list-default@example.com',
          password: 'x',
          status: 'Active',
          workspaceRoleId: admin.workspaceRoleId,
        },
      });

      projectOwnerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER);
      projectAdminRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN);
      developerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER);

      const project = await seedProject(owner.id, 'Target', 'Target desc');
      projectId = project.id;
      const other = await seedProject(owner.id, 'Other', 'Other desc');
      otherProjectId = other.id;

      await seedProjectMembership(projectId, owner.id, ProjectRoleName.PROJECT_OWNER);
      await seedProjectMembership(projectId, admin.id, ProjectRoleName.PROJECT_ADMIN);
      await seedProjectMembership(projectId, developer.id, ProjectRoleName.DEVELOPER);

      workspaceOwnerActor = userToActorContext(owner, []);
      workspaceAdminActor = userToActorContext(admin, []);
      workspaceDeveloperActor = userToActorContext(developer, []);
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

      projectOwnerActor = {
        ...workspaceOwnerActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: projectOwnerRoleId,
            projectRoleName: ProjectRoleName.PROJECT_OWNER,
          },
        ],
      };
      projectAdminActor = {
        ...workspaceAdminActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: projectAdminRoleId,
            projectRoleName: ProjectRoleName.PROJECT_ADMIN,
          },
        ],
      };
      projectDeveloperActor = {
        ...workspaceDeveloperActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: developerRoleId,
            projectRoleName: ProjectRoleName.DEVELOPER,
          },
        ],
      };

      // Seed 7 issues in the target project with alternating statuses so filter
      // probes have both matching and non-matching rows.
      seededIssues = [];
      for (let i = 0; i < 7; i++) {
        const status =
          i % 3 === 0 ? IssueStatus.ToDo : i % 3 === 1 ? IssueStatus.InProgress : IssueStatus.Done;
        const issue = await seedIssue({
          projectId,
          creatorId: owner.id,
          assigneeId: owner.id,
          title: `Issue ${i}`,
          description: `desc ${i}`,
          status,
          priority: IssuePriority.Medium,
        });
        seededIssues.push(issue);
      }

      // Seed 2 "other-project" issues to prove cross-project scoping excludes them.
      await seedIssue({
        projectId: otherProjectId,
        creatorId: owner.id,
        assigneeId: owner.id,
        title: 'Other-1',
        description: 'o1',
      });
      await seedIssue({
        projectId: otherProjectId,
        creatorId: owner.id,
        assigneeId: owner.id,
        title: 'Other-2',
        description: 'o2',
      });
    });

    afterAll(async () => {
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

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
        const response = await supertest(app)
          .get(`/api/v1/projects/${projectId}/issues`)
          .query({ pageSize: '100' })
          .set('Authorization', tokenFor(ctx.tokenService, projectOwnerActor));

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
        const response = await supertest(app)
          .get('/api/v1/projects/not-a-uuid/issues')
          .set('Authorization', tokenFor(ctx.tokenService, projectOwnerActor));

        expectValidationError(response, ['projectId']);
      });
    });

    describe('on unknown project (404)', () => {
      it('returns a not-found error for a well-formed but unknown projectId', async () => {
        const response = await supertest(app)
          .get(`/api/v1/projects/${WELL_FORMED_UNKNOWN_UUID}/issues`)
          .set('Authorization', tokenFor(ctx.tokenService, workspaceOwnerActor));

        expectResourceNotFoundError(response, ctx.projectRepository.resourceName);
      });
    });

    describe('on project-scope authorization failure (403)', () => {
      it('returns a forbidden error for a Developer with no project role on the target', async () => {
        const response = await supertest(app)
          .get(`/api/v1/projects/${projectId}/issues`)
          .set('Authorization', tokenFor(ctx.tokenService, nonMemberDeveloperActor));

        expectForbiddenError(response);
      });
    });

    describe('on response shape', () => {
      it('every list entry carries expanded creator and assignee objects with no raw scalar FKs', async () => {
        const response = await supertest(app)
          .get(`/api/v1/projects/${projectId}/issues`)
          .query({ pageSize: '100' })
          .set('Authorization', tokenFor(ctx.tokenService, projectOwnerActor));

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

  // -----------------------------------------------------------------------
  // GET /api/v1/projects/:projectId/issues/:id
  // -----------------------------------------------------------------------
  describe('GET /:id', () => {
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let nonMemberDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    let otherProjectId: string;
    let issueId: string;
    let otherProjectIssueId: string;

    beforeAll(async () => {
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();

      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) throw new Error('seed');

      // Create an extra non-member Developer user for the 403 case.
      const nonMemberDeveloper = await prisma.user.create({
        data: {
          name: 'Non-member Dev',
          email: 'issues-getbyid-nonmember@example.com',
          password: 'x',
          status: 'Active',
          workspaceRoleId: developer.workspaceRoleId,
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

      const projectOwnerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER);
      const projectAdminRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN);
      const developerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER);

      const project = await seedProject(owner.id, 'Target', 'desc');
      projectId = project.id;
      const other = await seedProject(owner.id, 'Other', 'other desc');
      otherProjectId = other.id;

      await seedProjectMembership(projectId, owner.id, ProjectRoleName.PROJECT_OWNER);
      await seedProjectMembership(projectId, admin.id, ProjectRoleName.PROJECT_ADMIN);
      await seedProjectMembership(projectId, developer.id, ProjectRoleName.DEVELOPER);

      workspaceOwnerActor = userToActorContext(owner, []);
      workspaceAdminActor = userToActorContext(admin, []);
      projectOwnerActor = {
        ...workspaceOwnerActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: projectOwnerRoleId,
            projectRoleName: ProjectRoleName.PROJECT_OWNER,
          },
        ],
      };
      projectAdminActor = {
        ...workspaceAdminActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: projectAdminRoleId,
            projectRoleName: ProjectRoleName.PROJECT_ADMIN,
          },
        ],
      };
      projectDeveloperActor = {
        userId: developer.id,
        workspaceRole: { id: developer.workspaceRoleId, name: WorkspaceRoleName.DEVELOPER },
        projectRoles: [
          { projectId, projectRoleId: developerRoleId, projectRoleName: ProjectRoleName.DEVELOPER },
        ],
      };

      const issue = await seedIssue({
        projectId,
        creatorId: owner.id,
        assigneeId: owner.id,
        title: 'The Issue',
        description: 'target desc',
      });
      issueId = issue.id;

      const otherIssue = await seedIssue({
        projectId: otherProjectId,
        creatorId: owner.id,
        assigneeId: owner.id,
        title: 'Other Issue',
        description: 'other desc',
      });
      otherProjectIssueId = otherIssue.id;
    });

    afterAll(async () => {
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
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

  // -----------------------------------------------------------------------
  // PATCH /api/v1/projects/:projectId/issues/:id
  // -----------------------------------------------------------------------
  describe('PATCH /:id', () => {
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    let otherProjectId: string;
    let issueId: string;
    let otherProjectIssueId: string;

    let projectOwnerRoleId: string;
    let projectAdminRoleId: string;
    let developerRoleId: string;

    let memberAssigneeUserId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) throw new Error('seed');

      projectOwnerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER);
      projectAdminRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN);
      developerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER);

      workspaceOwnerActor = userToActorContext(owner, []);
      workspaceAdminActor = userToActorContext(admin, []);
      workspaceDeveloperActor = userToActorContext(developer, []);

      memberAssigneeUserId = admin.id;
    });

    afterAll(async () => {
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    beforeEach(async () => {
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();

      const project = await seedProject(workspaceOwnerActor.userId, 'Target', 'desc');
      projectId = project.id;
      const other = await seedProject(workspaceOwnerActor.userId, 'Other', 'other');
      otherProjectId = other.id;

      await seedProjectMembership(
        projectId,
        workspaceOwnerActor.userId,
        ProjectRoleName.PROJECT_OWNER,
      );
      await seedProjectMembership(
        projectId,
        workspaceAdminActor.userId,
        ProjectRoleName.PROJECT_ADMIN,
      );
      await seedProjectMembership(
        projectId,
        workspaceDeveloperActor.userId,
        ProjectRoleName.DEVELOPER,
      );

      projectOwnerActor = {
        ...workspaceOwnerActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: projectOwnerRoleId,
            projectRoleName: ProjectRoleName.PROJECT_OWNER,
          },
        ],
      };
      projectAdminActor = {
        ...workspaceAdminActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: projectAdminRoleId,
            projectRoleName: ProjectRoleName.PROJECT_ADMIN,
          },
        ],
      };
      projectDeveloperActor = {
        ...workspaceDeveloperActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: developerRoleId,
            projectRoleName: ProjectRoleName.DEVELOPER,
          },
        ],
      };

      const issue = await seedIssue({
        projectId,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'Original title',
        description: 'Original desc',
        status: IssueStatus.ToDo,
        priority: IssuePriority.Medium,
      });
      issueId = issue.id;

      const otherIssue = await seedIssue({
        projectId: otherProjectId,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'Other issue',
        description: 'other desc',
      });
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

    describe('on success', () => {
      it.each([
        { case: 'Project Owner', getActor: () => projectOwnerActor },
        { case: 'Project Admin', getActor: () => projectAdminActor },
        { case: 'Developer', getActor: () => projectDeveloperActor },
      ])('updates any subset of fields for a $case', async ({ getActor }) => {
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

        expect(response.status).toBe(200);
        expect(response.body.data.title).toBe('New title');
        expect(response.body.data.description).toBe('New desc');
        expect(response.body.data.status).toBe(IssueStatus.InProgress);
        expect(response.body.data.priority).toBe(IssuePriority.High);
        expect(response.body.data.assignee.id).toBe(memberAssigneeUserId);

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
        await prisma.issue.update({ where: { id: issueId }, data: { status: from } });

        const response = await patchIssueRequest(
          projectId,
          issueId,
          { status: to },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe(to);
      });

      it('preserves a stale assignee when the PATCH does not include assigneeId', async () => {
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

        expect(response.status).toBe(200);
        expect(response.body.data.assignee.id).toBe(memberAssigneeUserId);

        const persisted = await fetchIssueWithRelations(issueId);
        expect(persisted?.assigneeId).toBe(memberAssigneeUserId);
      });
    });

    describe('on validation failure (400)', () => {
      it.each<{
        case: string;
        body: Record<string, unknown> | undefined | unknown[];
        expectedFieldSubset?: string[];
      }>([
        { case: 'empty body (no fields)', body: {} },
        {
          case: 'empty title',
          body: { title: '' },
          expectedFieldSubset: ['title'],
        },
        {
          case: 'empty description',
          body: { description: '' },
          expectedFieldSubset: ['description'],
        },
        {
          case: 'unknown status value',
          body: { status: 'Unknown' },
          expectedFieldSubset: ['status'],
        },
        {
          case: 'unknown priority value',
          body: { priority: 'URGENT' },
          expectedFieldSubset: ['priority'],
        },
        {
          case: 'malformed assigneeId',
          body: { assigneeId: 'not-a-uuid' },
          expectedFieldSubset: ['assigneeId'],
        },
        {
          case: 'extra field',
          body: { title: 't', foo: 'bar' },
          expectedFieldSubset: ['foo'],
        },
        { case: 'body is not a plain object', body: [] },
      ])('returns a validation error when $case', async ({ body, expectedFieldSubset }) => {
        const response = await patchIssueRequest(
          projectId,
          issueId,
          body,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        if (expectedFieldSubset) {
          expectValidationError(response, expectedFieldSubset);
        } else {
          expect(response.status).toBe(400);
        }

        await expectIssueUnchanged(issueId, {
          title: 'Original title',
          description: 'Original desc',
          status: IssueStatus.ToDo,
          priority: IssuePriority.Medium,
          assigneeId: workspaceOwnerActor.userId,
        });
      });

      it('returns a validation error when the path projectId is not a uuid', async () => {
        const response = await patchIssueRequest(
          'not-a-uuid',
          issueId,
          { title: 't' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['projectId']);
      });

      it('returns a validation error when the path issue id is not a uuid', async () => {
        const response = await patchIssueRequest(
          projectId,
          'not-a-uuid',
          { title: 't' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['issueId']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and does not modify the issue', async () => {
        const response = await patchIssueRequest(projectId, issueId, { title: 'x' });

        expectAuthenticationRequired(response);
        await expectIssueUnchanged(issueId, {
          title: 'Original title',
          description: 'Original desc',
          status: IssueStatus.ToDo,
          priority: IssuePriority.Medium,
          assigneeId: workspaceOwnerActor.userId,
        });
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
        await expectIssueUnchanged(issueId, {
          title: 'Original title',
          description: 'Original desc',
          status: IssueStatus.ToDo,
          priority: IssuePriority.Medium,
          assigneeId: workspaceOwnerActor.userId,
        });
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
      it('returns 422 when assigneeId references a user who is not a project member', async () => {
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
        await expectIssueUnchanged(issueId, {
          title: 'Original title',
          description: 'Original desc',
          status: IssueStatus.ToDo,
          priority: IssuePriority.Medium,
          assigneeId: workspaceOwnerActor.userId,
        });
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
      });
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/v1/projects/:projectId/issues/:id
  // -----------------------------------------------------------------------
  describe('DELETE /:id', () => {
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    let otherProjectId: string;
    let issueId: string;
    let otherProjectIssueId: string;

    let projectOwnerRoleId: string;
    let projectAdminRoleId: string;
    let developerRoleId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) throw new Error('seed');

      projectOwnerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER);
      projectAdminRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN);
      developerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER);

      workspaceOwnerActor = userToActorContext(owner, []);
      workspaceAdminActor = userToActorContext(admin, []);
      workspaceDeveloperActor = userToActorContext(developer, []);
    });

    afterAll(async () => {
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    beforeEach(async () => {
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();

      const project = await seedProject(workspaceOwnerActor.userId, 'Target', 'desc');
      projectId = project.id;
      const other = await seedProject(workspaceOwnerActor.userId, 'Other', 'other');
      otherProjectId = other.id;

      await seedProjectMembership(
        projectId,
        workspaceOwnerActor.userId,
        ProjectRoleName.PROJECT_OWNER,
      );
      await seedProjectMembership(
        projectId,
        workspaceAdminActor.userId,
        ProjectRoleName.PROJECT_ADMIN,
      );
      await seedProjectMembership(
        projectId,
        workspaceDeveloperActor.userId,
        ProjectRoleName.DEVELOPER,
      );

      projectOwnerActor = {
        ...workspaceOwnerActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: projectOwnerRoleId,
            projectRoleName: ProjectRoleName.PROJECT_OWNER,
          },
        ],
      };
      projectAdminActor = {
        ...workspaceAdminActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: projectAdminRoleId,
            projectRoleName: ProjectRoleName.PROJECT_ADMIN,
          },
        ],
      };
      projectDeveloperActor = {
        ...workspaceDeveloperActor,
        projectRoles: [
          {
            projectId,
            projectRoleId: developerRoleId,
            projectRoleName: ProjectRoleName.DEVELOPER,
          },
        ],
      };

      const issue = await seedIssue({
        projectId,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'Target issue',
        description: 'desc',
      });
      issueId = issue.id;

      const otherIssue = await seedIssue({
        projectId: otherProjectId,
        creatorId: workspaceOwnerActor.userId,
        assigneeId: workspaceOwnerActor.userId,
        title: 'Other issue',
        description: 'other desc',
      });
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
      });

      it('returns a validation error when the path issue id is not a uuid', async () => {
        const response = await deleteIssueRequest(
          projectId,
          'not-a-uuid',
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectValidationError(response, ['issueId']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and does not delete', async () => {
        const response = await deleteIssueRequest(projectId, issueId);

        expectAuthenticationRequired(response);
        const row = await prisma.issue.findUnique({ where: { id: issueId } });
        expect(row).not.toBeNull();
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
        const row = await prisma.issue.findUnique({ where: { id: issueId } });
        expect(row).not.toBeNull();
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
      });

      it('returns 404 and does not delete the issue when it belongs to a different project', async () => {
        const response = await deleteIssueRequest(
          projectId,
          otherProjectIssueId,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.issueRepository.resourceName);
        const other = await prisma.issue.findUnique({ where: { id: otherProjectIssueId } });
        expect(other).not.toBeNull();
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
      });
    });
  });
});
