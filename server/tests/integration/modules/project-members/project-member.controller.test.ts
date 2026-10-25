import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import supertest from 'supertest';

import { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { prisma } from '@/common/lib/prisma';
import { ProjectRoleName } from '@/modules/project-roles';
import { WorkspaceRoleName } from '@/modules/workspace-roles';

import { createTestUsers } from '../../fixtures/users.fixtures';
import { ensureWorkspaceRolesSeeded } from '../../fixtures/workspace-roles.fixtures';
import { fetchProjectRoleIdByName } from '../../fixtures/project-roles.fixtures';
import { seedProject } from '../../fixtures/projects.fixtures';
import { ensureProjectRolesSeeded } from '../../fixtures/project-roles.fixtures';
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
  expectConflictError,
  expectForbiddenError,
  expectInternalServerError,
  expectResourceNotFoundError,
  expectValidationError,
} from '../../assertions/errors.assertions';

import {
  createProjectMembersTestContext,
  ProjectMembersTestContext,
  testUsers,
} from './project-member.controller.fixtures';
import {
  ExpectedExpandedMember,
  expectExpandedMemberListResponse,
  expectExpandedMemberResponse,
  expectMemberAbsent,
  expectMemberPersisted,
  expectMemberWithRole,
  expectNoContentResponse,
  expectNoMemberForUser,
} from './project-member.controller.assertions';

const WELL_FORMED_UNKNOWN_UUID = '11111111-1111-4111-8111-111111111111';
const WELL_FORMED_UNKNOWN_UUID_2 = '22222222-2222-4222-8222-222222222222';
const WELL_FORMED_UNKNOWN_UUID_3 = '33333333-3333-4333-8333-333333333333';

describe('ProjectMembers Controller', () => {
  let app: Application;
  let ctx: ProjectMembersTestContext;

  beforeAll(async () => {
    ctx = createProjectMembersTestContext();
    app = ctx.app;

    await ensureWorkspaceRolesSeeded();
    await ensureProjectRolesSeeded();
  });

  describe('POST /', () => {
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let targetUserId: string;

    let projectId: string;

    let developerProjectRoleId: string;
    let projectAdminRoleId: string;
    let projectOwnerRoleId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);

      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      workspaceOwnerActor = userToActorContext(owner, []);
      workspaceAdminActor = userToActorContext(admin, []);
      workspaceDeveloperActor = userToActorContext(developer, []);

      targetUserId = developer.id;

      developerProjectRoleId = await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER);
      projectAdminRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN);
      projectOwnerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER);
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    beforeEach(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();

      const project = await seedProject(workspaceOwnerActor.userId, 'Add Target', 'add target');
      projectId = project.id;
    });

    function spyProjectRoles(actor: ActorContext): void {
      jest.spyOn(ctx.projectMemberRepository, 'getProjectMembersByUserId').mockResolvedValue(
        actor.projectRoles.map((role) => ({
          id: '00000000-0000-0000-0000-000000000000',
          projectId: role.projectId,
          userId: actor.userId,
          projectRoleId: role.projectRoleId,
          projectRole: { id: role.projectRoleId, name: role.projectRoleName },
        })),
      );
    }

    function addMemberRequest(
      pathProjectId: string,
      body: Record<string, unknown> | undefined | unknown[],
      authorizationHeader?: string,
    ) {
      const request = supertest(app).post(`/api/v1/projects/${pathProjectId}/members`);
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request.send(body);
    }

    describe('on success', () => {
      it.each([
        {
          case: 'Workspace Owner adds a Project Admin',
          getActor: () => workspaceOwnerActor,
          roleId: () => projectAdminRoleId,
          roleName: ProjectRoleName.PROJECT_ADMIN,
        },
        {
          case: 'Workspace Owner adds a Developer',
          getActor: () => workspaceOwnerActor,
          roleId: () => developerProjectRoleId,
          roleName: ProjectRoleName.DEVELOPER,
        },
      ])('creates a member and returns 201 when $case', async ({ getActor, roleId, roleName }) => {
        const actor = getActor();

        const response = await addMemberRequest(
          projectId,
          { userId: targetUserId, projectRoleId: roleId() },
          tokenFor(ctx.tokenService, actor),
        );

        const developerUser = requireTestUser(testUsers, WorkspaceRoleName.DEVELOPER);

        expectExpandedMemberResponse(response, 201, {
          projectId,
          user: {
            id: targetUserId,
            name: developerUser.name,
            email: developerUser.email,
          },
          projectRole: { id: roleId(), name: roleName },
        });

        await expectMemberPersisted(response.body.data.id, {
          projectId,
          userId: targetUserId,
          projectRoleId: roleId(),
        });
      });

      it('creates a Project Admin member when Project Owner adds one', async () => {
        const projectOwnerMembership = await seedProjectMembership(
          projectId,
          workspaceDeveloperActor.userId,
          ProjectRoleName.PROJECT_OWNER,
        );
        const actor = userToActorContext(
          {
            id: workspaceDeveloperActor.userId,
            workspaceRoleId: workspaceDeveloperActor.workspaceRole.id,
            workspaceRoleName: WorkspaceRoleName.DEVELOPER,
          },
          [
            {
              projectId,
              projectRoleId: projectOwnerMembership.projectRoleId,
              projectRoleName: ProjectRoleName.PROJECT_OWNER,
            },
          ],
        );
        spyProjectRoles(actor);

        const response = await addMemberRequest(
          projectId,
          { userId: workspaceAdminActor.userId, projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, actor),
        );

        expect(response.status).toBe(201);
      });

      it('creates a Developer member when Project Owner adds one', async () => {
        const projectOwnerMembership = await seedProjectMembership(
          projectId,
          workspaceDeveloperActor.userId,
          ProjectRoleName.PROJECT_OWNER,
        );
        const actor = userToActorContext(
          {
            id: workspaceDeveloperActor.userId,
            workspaceRoleId: workspaceDeveloperActor.workspaceRole.id,
            workspaceRoleName: WorkspaceRoleName.DEVELOPER,
          },
          [
            {
              projectId,
              projectRoleId: projectOwnerMembership.projectRoleId,
              projectRoleName: ProjectRoleName.PROJECT_OWNER,
            },
          ],
        );
        spyProjectRoles(actor);

        const response = await addMemberRequest(
          projectId,
          { userId: workspaceAdminActor.userId, projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, actor),
        );

        expect(response.status).toBe(201);
      });

      it('creates a Developer member when Project Admin adds one', async () => {
        const projectAdminMembership = await seedProjectMembership(
          projectId,
          workspaceDeveloperActor.userId,
          ProjectRoleName.PROJECT_ADMIN,
        );
        const actor = userToActorContext(
          {
            id: workspaceDeveloperActor.userId,
            workspaceRoleId: workspaceDeveloperActor.workspaceRole.id,
            workspaceRoleName: WorkspaceRoleName.DEVELOPER,
          },
          [
            {
              projectId,
              projectRoleId: projectAdminMembership.projectRoleId,
              projectRoleName: ProjectRoleName.PROJECT_ADMIN,
            },
          ],
        );
        spyProjectRoles(actor);

        const response = await addMemberRequest(
          projectId,
          { userId: workspaceAdminActor.userId, projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, actor),
        );

        expect(response.status).toBe(201);
      });
    });

    describe('on validation failure (400)', () => {
      it.each<{
        case: string;
        body: Record<string, unknown> | undefined | unknown[];
        expectedFields: string[];
      }>([
        {
          case: 'userId is missing',
          body: { projectRoleId: WELL_FORMED_UNKNOWN_UUID },
          expectedFields: ['userId'],
        },
        {
          case: 'projectRoleId is missing',
          body: { userId: WELL_FORMED_UNKNOWN_UUID },
          expectedFields: ['projectRoleId'],
        },
        {
          case: 'userId is malformed',
          body: { userId: 'not-a-uuid', projectRoleId: WELL_FORMED_UNKNOWN_UUID },
          expectedFields: ['userId'],
        },
        {
          case: 'projectRoleId is malformed',
          body: { userId: WELL_FORMED_UNKNOWN_UUID, projectRoleId: 'not-a-uuid' },
          expectedFields: ['projectRoleId'],
        },
        {
          case: 'request body is undefined',
          body: undefined,
          expectedFields: ['userId', 'projectRoleId'],
        },
        {
          case: 'request body is not a plain object',
          body: [],
          expectedFields: ['userId', 'projectRoleId'],
        },
        {
          case: 'extra fields are present',
          body: {
            userId: WELL_FORMED_UNKNOWN_UUID,
            projectRoleId: WELL_FORMED_UNKNOWN_UUID_2,
            foo: 'bar',
          },
          expectedFields: ['foo'],
        },
      ])('returns a validation error when $case', async ({ body, expectedFields }) => {
        const response = await addMemberRequest(
          projectId,
          body,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectValidationError(response, expectedFields);
        await expectNoMemberForUser(projectId, targetUserId);
      });

      it('returns a validation error when the path project id is not a uuid', async () => {
        const response = await addMemberRequest(
          'not-a-uuid',
          { userId: targetUserId, projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectValidationError(response, ['projectId']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and creates nothing', async () => {
        const response = await addMemberRequest(projectId, {
          userId: targetUserId,
          projectRoleId: developerProjectRoleId,
        });

        expectAuthenticationRequired(response);
        await expectNoMemberForUser(projectId, targetUserId);
      });
    });

    describe('on authorization failures (403)', () => {
      it('returns a forbidden error for a Workspace Admin without a project role', async () => {
        const response = await addMemberRequest(
          projectId,
          { userId: targetUserId, projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, workspaceAdminActor),
        );

        expectForbiddenError(response);
        await expectNoMemberForUser(projectId, targetUserId);
      });

      it('returns a forbidden error for a Developer who is a Developer-tier project member', async () => {
        const membership = await seedProjectMembership(
          projectId,
          workspaceDeveloperActor.userId,
          ProjectRoleName.DEVELOPER,
        );
        const actor: ActorContext = {
          ...workspaceDeveloperActor,
          projectRoles: [
            {
              projectId,
              projectRoleId: membership.projectRoleId,
              projectRoleName: ProjectRoleName.DEVELOPER,
            },
          ],
        };
        spyProjectRoles(actor);

        const response = await addMemberRequest(
          projectId,
          { userId: workspaceAdminActor.userId, projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, actor),
        );

        expectForbiddenError(response);
        await expectNoMemberForUser(projectId, workspaceAdminActor.userId);
      });

      it('returns a forbidden error for a non-member Developer', async () => {
        const response = await addMemberRequest(
          projectId,
          { userId: workspaceAdminActor.userId, projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, workspaceDeveloperActor),
        );

        expectForbiddenError(response);
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown project id (Workspace Owner bypass)', async () => {
        const response = await addMemberRequest(
          WELL_FORMED_UNKNOWN_UUID,
          { userId: targetUserId, projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.projectRepository.resourceName);
      });
    });

    describe('on conflict (409)', () => {
      it('returns a conflict error when the (projectId, userId) pair already exists', async () => {
        await seedProjectMembership(projectId, targetUserId, ProjectRoleName.DEVELOPER);

        const response = await addMemberRequest(
          projectId,
          { userId: targetUserId, projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectConflictError(response);
      });
    });

    describe('on business rule violations (422)', () => {
      it('returns 422 when userId does not reference any existing user (FK violation)', async () => {
        const response = await addMemberRequest(
          projectId,
          { userId: WELL_FORMED_UNKNOWN_UUID_3, projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await expectNoMemberForUser(projectId, WELL_FORMED_UNKNOWN_UUID_3);
      });

      it('returns 422 when projectRoleId does not resolve to any project role', async () => {
        const response = await addMemberRequest(
          projectId,
          { userId: targetUserId, projectRoleId: WELL_FORMED_UNKNOWN_UUID },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await expectNoMemberForUser(projectId, targetUserId);
      });

      it('returns 422 when projectRoleId resolves to the Project Owner role', async () => {
        const response = await addMemberRequest(
          projectId,
          { userId: targetUserId, projectRoleId: projectOwnerRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await expectNoMemberForUser(projectId, targetUserId);
      });

      it('returns 422 when a Project Admin attempts to add a Project Admin target (ladder)', async () => {
        const projectAdminMembership = await seedProjectMembership(
          projectId,
          workspaceDeveloperActor.userId,
          ProjectRoleName.PROJECT_ADMIN,
        );
        const actor: ActorContext = {
          ...workspaceDeveloperActor,
          projectRoles: [
            {
              projectId,
              projectRoleId: projectAdminMembership.projectRoleId,
              projectRoleName: ProjectRoleName.PROJECT_ADMIN,
            },
          ],
        };
        spyProjectRoles(actor);

        const response = await addMemberRequest(
          projectId,
          { userId: workspaceAdminActor.userId, projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, actor),
        );

        expectBusinessRuleViolationError(response);
        await expectNoMemberForUser(projectId, workspaceAdminActor.userId);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when the project-member repository createProjectMember throws', async () => {
        jest
          .spyOn(ctx.projectMemberRepository, 'createProjectMember')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await addMemberRequest(
          projectId,
          { userId: targetUserId, projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectInternalServerError(response);
      });
    });
  });

  describe('GET /', () => {
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectId: string;

    let projectOwnerMemberId: string;
    let projectAdminMemberId: string;
    let developerMemberId: string;

    let projectOwnerRoleId: string;
    let projectAdminRoleId: string;
    let developerProjectRoleId: string;

    let ownerUserId: string;
    let adminUserId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);

      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      workspaceOwnerActor = userToActorContext(owner, []);
      workspaceAdminActor = userToActorContext(admin, []);
      workspaceDeveloperActor = userToActorContext(developer, []);

      ownerUserId = owner.id;
      adminUserId = admin.id;

      projectOwnerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER);
      projectAdminRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN);
      developerProjectRoleId = await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER);
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    beforeEach(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();

      const project = await seedProject(ownerUserId, 'List Target', 'list target');
      projectId = project.id;

      const owner = await seedProjectMembership(
        projectId,
        ownerUserId,
        ProjectRoleName.PROJECT_OWNER,
      );
      const admin = await seedProjectMembership(
        projectId,
        adminUserId,
        ProjectRoleName.PROJECT_ADMIN,
      );
      const dev = await seedProjectMembership(
        projectId,
        workspaceDeveloperActor.userId,
        ProjectRoleName.DEVELOPER,
      );

      projectOwnerMemberId = owner.id;
      projectAdminMemberId = admin.id;
      developerMemberId = dev.id;
    });

    function spyProjectRoles(actor: ActorContext): void {
      jest.spyOn(ctx.projectMemberRepository, 'getProjectMembersByUserId').mockResolvedValue(
        actor.projectRoles.map((role) => ({
          id: '00000000-0000-0000-0000-000000000000',
          projectId: role.projectId,
          userId: actor.userId,
          projectRoleId: role.projectRoleId,
          projectRole: { id: role.projectRoleId, name: role.projectRoleName },
        })),
      );
    }

    function listMembersRequest(
      pathProjectId: string,
      authorizationHeader?: string,
      query?: Record<string, string>,
    ) {
      let request = supertest(app).get(`/api/v1/projects/${pathProjectId}/members`);
      if (authorizationHeader !== undefined) {
        request = request.set('Authorization', authorizationHeader);
      }
      if (query) {
        request = request.query(query);
      }
      return request;
    }

    describe('on success', () => {
      function expectedFullMemberList(): ExpectedExpandedMember[] {
        const ownerUser = requireTestUser(testUsers, WorkspaceRoleName.OWNER);
        const adminUser = requireTestUser(testUsers, WorkspaceRoleName.ADMIN);
        const developerUser = requireTestUser(testUsers, WorkspaceRoleName.DEVELOPER);

        const entries: (ExpectedExpandedMember & { id: string })[] = [
          {
            id: projectOwnerMemberId,
            projectId,
            user: { id: ownerUserId, name: ownerUser.name, email: ownerUser.email },
            projectRole: { id: projectOwnerRoleId, name: ProjectRoleName.PROJECT_OWNER },
          },
          {
            id: projectAdminMemberId,
            projectId,
            user: { id: adminUserId, name: adminUser.name, email: adminUser.email },
            projectRole: { id: projectAdminRoleId, name: ProjectRoleName.PROJECT_ADMIN },
          },
          {
            id: developerMemberId,
            projectId,
            user: {
              id: workspaceDeveloperActor.userId,
              name: developerUser.name,
              email: developerUser.email,
            },
            projectRole: { id: developerProjectRoleId, name: ProjectRoleName.DEVELOPER },
          },
        ];
        return entries.sort((a, b) => a.id.localeCompare(b.id));
      }

      it.each([
        {
          case: 'Workspace Owner (bypass)',
          getActor: () => workspaceOwnerActor,
          spyRoles: false,
        },
        {
          case: 'Workspace Admin (bypass)',
          getActor: () => workspaceAdminActor,
          spyRoles: false,
        },
        {
          case: 'Project Owner member',
          getActor: (): ActorContext => ({
            ...workspaceDeveloperActor,
            projectRoles: [
              {
                projectId,
                projectRoleId: projectOwnerRoleId,
                projectRoleName: ProjectRoleName.PROJECT_OWNER,
              },
            ],
          }),
          spyRoles: true,
        },
        {
          case: 'Project Admin member',
          getActor: (): ActorContext => ({
            ...workspaceDeveloperActor,
            projectRoles: [
              {
                projectId,
                projectRoleId: projectAdminRoleId,
                projectRoleName: ProjectRoleName.PROJECT_ADMIN,
              },
            ],
          }),
          spyRoles: true,
        },
        {
          case: 'Developer member',
          getActor: (): ActorContext => ({
            ...workspaceDeveloperActor,
            projectRoles: [
              {
                projectId,
                projectRoleId: developerProjectRoleId,
                projectRoleName: ProjectRoleName.DEVELOPER,
              },
            ],
          }),
          spyRoles: true,
        },
      ])('returns the full member list for a $case', async ({ getActor, spyRoles }) => {
        const actor = getActor();
        if (spyRoles) {
          spyProjectRoles(actor);
        }

        const response = await listMembersRequest(projectId, tokenFor(ctx.tokenService, actor));

        expectExpandedMemberListResponse(response, expectedFullMemberList());
      });
    });

    describe('on validation failure (400)', () => {
      it('returns a 400 when the path project id is not a uuid', async () => {
        const response = await listMembersRequest(
          'not-a-uuid',
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectValidationError(response, ['projectId']);
      });

      it.each<{ case: string; query: Record<string, string>; expectedField: string }>([
        { case: '?page=1', query: { page: '1' }, expectedField: 'page' },
        { case: '?pageSize=10', query: { pageSize: '10' }, expectedField: 'pageSize' },
        { case: '?sort=id', query: { sort: 'id' }, expectedField: 'sort' },
        {
          case: '?filter[userId]=...',
          query: { 'filter[userId]': WELL_FORMED_UNKNOWN_UUID },
          expectedField: 'filter',
        },
      ])('returns a 400 when the request includes $case', async ({ query, expectedField }) => {
        const response = await listMembersRequest(
          projectId,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
          query,
        );

        expectValidationError(response, [expectedField]);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error', async () => {
        const response = await listMembersRequest(projectId);
        expectAuthenticationRequired(response);
      });
    });

    describe('on authorization failures (403)', () => {
      it('returns a forbidden error for a non-member Developer', async () => {
        // The seeded `developer` user is a Developer-tier member of `projectId`
        // via `beforeEach`. Spy `getProjectMembersByUserId` to simulate a
        // non-member Developer whose matrix lookup for `listProjectMembers`
        // then fails (no project role, workspace role is not in bypass).
        jest.spyOn(ctx.projectMemberRepository, 'getProjectMembersByUserId').mockResolvedValue([]);

        const response = await listMembersRequest(
          projectId,
          tokenFor(ctx.tokenService, workspaceDeveloperActor),
        );

        expectForbiddenError(response);
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown project id (Workspace Owner bypass)', async () => {
        const response = await listMembersRequest(
          WELL_FORMED_UNKNOWN_UUID,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.projectRepository.resourceName);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when listProjectMembers throws', async () => {
        jest
          .spyOn(ctx.projectMemberRepository, 'listProjectMembers')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await listMembersRequest(
          projectId,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectInternalServerError(response);
      });
    });
  });

  describe('PATCH /:memberId', () => {
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectId: string;
    let otherProjectId: string;

    let projectOwnerMemberId: string;
    let projectAdminMemberId: string;
    let developerMemberId: string;
    let otherProjectMemberId: string;

    let ownerUserId: string;
    let adminUserId: string;

    let projectOwnerRoleId: string;
    let projectAdminRoleId: string;
    let developerProjectRoleId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      workspaceOwnerActor = userToActorContext(owner, []);
      workspaceAdminActor = userToActorContext(admin, []);
      workspaceDeveloperActor = userToActorContext(developer, []);

      ownerUserId = owner.id;
      adminUserId = admin.id;

      projectOwnerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER);
      projectAdminRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN);
      developerProjectRoleId = await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER);
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    beforeEach(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();

      const project = await seedProject(ownerUserId, 'Update Target', 'update target');
      projectId = project.id;

      const other = await seedProject(ownerUserId, 'Other Project', 'other project');
      otherProjectId = other.id;

      const owner = await seedProjectMembership(
        projectId,
        ownerUserId,
        ProjectRoleName.PROJECT_OWNER,
      );
      const admin = await seedProjectMembership(
        projectId,
        adminUserId,
        ProjectRoleName.PROJECT_ADMIN,
      );
      const dev = await seedProjectMembership(
        projectId,
        workspaceDeveloperActor.userId,
        ProjectRoleName.DEVELOPER,
      );

      projectOwnerMemberId = owner.id;
      projectAdminMemberId = admin.id;
      developerMemberId = dev.id;

      const otherOwner = await seedProjectMembership(
        otherProjectId,
        ownerUserId,
        ProjectRoleName.PROJECT_OWNER,
      );
      otherProjectMemberId = otherOwner.id;
    });

    function spyProjectRoles(actor: ActorContext): void {
      jest.spyOn(ctx.projectMemberRepository, 'getProjectMembersByUserId').mockResolvedValue(
        actor.projectRoles.map((role) => ({
          id: '00000000-0000-0000-0000-000000000000',
          projectId: role.projectId,
          userId: actor.userId,
          projectRoleId: role.projectRoleId,
          projectRole: { id: role.projectRoleId, name: role.projectRoleName },
        })),
      );
    }

    function updateRoleRequest(
      pathProjectId: string,
      pathMemberId: string,
      body: Record<string, unknown> | undefined | unknown[],
      authorizationHeader?: string,
    ) {
      const request = supertest(app).patch(
        `/api/v1/projects/${pathProjectId}/members/${pathMemberId}`,
      );
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request.send(body);
    }

    describe('on success', () => {
      it('promotes a Developer to Project Admin for a Workspace Owner', async () => {
        const response = await updateRoleRequest(
          projectId,
          developerMemberId,
          { projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        const developerUser = requireTestUser(testUsers, WorkspaceRoleName.DEVELOPER);

        expectExpandedMemberResponse(response, 200, {
          projectId,
          user: {
            id: workspaceDeveloperActor.userId,
            name: developerUser.name,
            email: developerUser.email,
          },
          projectRole: { id: projectAdminRoleId, name: ProjectRoleName.PROJECT_ADMIN },
        });

        await expectMemberWithRole(developerMemberId, ProjectRoleName.PROJECT_ADMIN);
      });

      it('promotes a Developer to Project Admin for a Project Owner member', async () => {
        // workspaceOwnerActor is already the Project Owner (seeded by beforeEach).
        // Spoofing a different Project Owner via spy for symmetry.
        spyProjectRoles(workspaceOwnerActor);

        const response = await updateRoleRequest(
          projectId,
          developerMemberId,
          { projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        const developerUser = requireTestUser(testUsers, WorkspaceRoleName.DEVELOPER);

        expectExpandedMemberResponse(response, 200, {
          projectId,
          user: {
            id: workspaceDeveloperActor.userId,
            name: developerUser.name,
            email: developerUser.email,
          },
          projectRole: { id: projectAdminRoleId, name: ProjectRoleName.PROJECT_ADMIN },
        });

        await expectMemberWithRole(developerMemberId, ProjectRoleName.PROJECT_ADMIN);
      });

      it('demotes a Project Admin to Developer for a Project Owner member', async () => {
        const response = await updateRoleRequest(
          projectId,
          projectAdminMemberId,
          { projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        const adminUser = requireTestUser(testUsers, WorkspaceRoleName.ADMIN);

        expectExpandedMemberResponse(response, 200, {
          projectId,
          user: {
            id: adminUserId,
            name: adminUser.name,
            email: adminUser.email,
          },
          projectRole: { id: developerProjectRoleId, name: ProjectRoleName.DEVELOPER },
        });

        await expectMemberWithRole(projectAdminMemberId, ProjectRoleName.DEVELOPER);
      });
    });

    describe('on validation failure (400)', () => {
      it.each<{
        case: string;
        body: Record<string, unknown> | undefined | unknown[];
        expectedFields: string[];
      }>([
        { case: 'projectRoleId is missing', body: {}, expectedFields: ['projectRoleId'] },
        {
          case: 'projectRoleId is malformed',
          body: { projectRoleId: 'not-a-uuid' },
          expectedFields: ['projectRoleId'],
        },
        {
          case: 'extra field is present',
          body: { projectRoleId: WELL_FORMED_UNKNOWN_UUID, foo: 'bar' },
          expectedFields: ['foo'],
        },
        { case: 'body is undefined', body: undefined, expectedFields: ['projectRoleId'] },
        { case: 'body is not a plain object', body: [], expectedFields: ['projectRoleId'] },
      ])('returns a 400 when $case', async ({ body, expectedFields }) => {
        const response = await updateRoleRequest(
          projectId,
          developerMemberId,
          body,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectValidationError(response, expectedFields);
      });

      it('returns 400 when the path project id is malformed', async () => {
        const response = await updateRoleRequest(
          'not-a-uuid',
          developerMemberId,
          { projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectValidationError(response, ['projectId']);
      });

      it('returns 400 when the path member id is malformed', async () => {
        const response = await updateRoleRequest(
          projectId,
          'not-a-uuid',
          { projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectValidationError(response, ['memberId']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and modifies nothing', async () => {
        const response = await updateRoleRequest(projectId, developerMemberId, {
          projectRoleId: projectAdminRoleId,
        });

        expectAuthenticationRequired(response);
        await expectMemberWithRole(developerMemberId, ProjectRoleName.DEVELOPER);
      });
    });

    describe('on authorization failures (403)', () => {
      it.each([
        {
          case: 'Workspace Admin without the Project Owner role',
          getActor: () => workspaceAdminActor,
          needsSpy: false,
        },
        {
          case: 'Project Admin member',
          getActor: () => ({
            ...workspaceDeveloperActor,
            projectRoles: [
              {
                projectId,
                projectRoleId: projectAdminRoleId,
                projectRoleName: ProjectRoleName.PROJECT_ADMIN,
              },
            ],
          }),
          needsSpy: true,
        },
        {
          case: 'Developer member',
          getActor: () => ({
            ...workspaceDeveloperActor,
            projectRoles: [
              {
                projectId,
                projectRoleId: developerProjectRoleId,
                projectRoleName: ProjectRoleName.DEVELOPER,
              },
            ],
          }),
          needsSpy: true,
        },
      ])('returns a forbidden error for $case', async ({ getActor, needsSpy }) => {
        const actor = getActor();
        if (needsSpy) spyProjectRoles(actor);

        const response = await updateRoleRequest(
          projectId,
          developerMemberId,
          { projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, actor),
        );

        expectForbiddenError(response);
        await expectMemberWithRole(developerMemberId, ProjectRoleName.DEVELOPER);
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown member id', async () => {
        const response = await updateRoleRequest(
          projectId,
          WELL_FORMED_UNKNOWN_UUID,
          { projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.projectMemberRepository.resourceName);
      });

      it('returns a not-found error when the member belongs to a different project', async () => {
        const response = await updateRoleRequest(
          projectId,
          otherProjectMemberId,
          { projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.projectMemberRepository.resourceName);
      });
    });

    describe('on business rule violations (422)', () => {
      it('returns 422 when the target is the Project Owner member (owner-immutable)', async () => {
        const response = await updateRoleRequest(
          projectId,
          projectOwnerMemberId,
          { projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await expectMemberWithRole(projectOwnerMemberId, ProjectRoleName.PROJECT_OWNER);
      });

      it("returns 422 when the target is the actor's own membership (self-mutation)", async () => {
        // PATCH self-mutation is only reachable when the actor is authorized
        // (WO bypass or Project Owner) AND the target is the actor's own
        // non-Owner membership — owner-immutable fires first on the Owner row.
        // Seed: developer owns the project; Workspace Owner is enrolled as
        // Project Admin and attempts to change their own role.
        await prisma.projectMember.deleteMany({ where: { projectId } });
        await seedProjectMembership(
          projectId,
          workspaceDeveloperActor.userId,
          ProjectRoleName.PROJECT_OWNER,
        );
        const selfMembership = await seedProjectMembership(
          projectId,
          workspaceOwnerActor.userId,
          ProjectRoleName.PROJECT_ADMIN,
        );

        const response = await updateRoleRequest(
          projectId,
          selfMembership.id,
          { projectRoleId: developerProjectRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await expectMemberWithRole(selfMembership.id, ProjectRoleName.PROJECT_ADMIN);
      });

      it('returns 422 when projectRoleId does not resolve to any project role', async () => {
        const response = await updateRoleRequest(
          projectId,
          developerMemberId,
          { projectRoleId: WELL_FORMED_UNKNOWN_UUID },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await expectMemberWithRole(developerMemberId, ProjectRoleName.DEVELOPER);
      });

      it('returns 422 when projectRoleId resolves to the Project Owner role', async () => {
        const response = await updateRoleRequest(
          projectId,
          developerMemberId,
          { projectRoleId: projectOwnerRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        await expectMemberWithRole(developerMemberId, ProjectRoleName.DEVELOPER);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when updateProjectMemberRole throws', async () => {
        jest
          .spyOn(ctx.projectMemberRepository, 'updateProjectMemberRole')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await updateRoleRequest(
          projectId,
          developerMemberId,
          { projectRoleId: projectAdminRoleId },
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectInternalServerError(response);
      });
    });
  });

  describe('DELETE /:memberId', () => {
    let workspaceOwnerActor: ActorContext;
    let workspaceAdminActor: ActorContext;
    let workspaceDeveloperActor: ActorContext;

    let projectId: string;
    let otherProjectId: string;

    let projectOwnerMemberId: string;
    let projectAdminMemberId: string;
    let developerMemberId: string;
    let otherProjectMemberId: string;

    let ownerUserId: string;
    let adminUserId: string;

    let projectAdminRoleId: string;
    let developerProjectRoleId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      workspaceOwnerActor = userToActorContext(owner, []);
      workspaceAdminActor = userToActorContext(admin, []);
      workspaceDeveloperActor = userToActorContext(developer, []);

      ownerUserId = owner.id;
      adminUserId = admin.id;

      projectAdminRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN);
      developerProjectRoleId = await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER);
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    beforeEach(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();

      const project = await seedProject(ownerUserId, 'Delete Target', 'delete target');
      projectId = project.id;

      const other = await seedProject(ownerUserId, 'Other Delete Project', 'other');
      otherProjectId = other.id;

      const owner = await seedProjectMembership(
        projectId,
        ownerUserId,
        ProjectRoleName.PROJECT_OWNER,
      );
      const admin = await seedProjectMembership(
        projectId,
        adminUserId,
        ProjectRoleName.PROJECT_ADMIN,
      );
      const dev = await seedProjectMembership(
        projectId,
        workspaceDeveloperActor.userId,
        ProjectRoleName.DEVELOPER,
      );

      projectOwnerMemberId = owner.id;
      projectAdminMemberId = admin.id;
      developerMemberId = dev.id;

      const otherOwner = await seedProjectMembership(
        otherProjectId,
        ownerUserId,
        ProjectRoleName.PROJECT_OWNER,
      );
      otherProjectMemberId = otherOwner.id;
    });

    function spyProjectRoles(actor: ActorContext): void {
      jest.spyOn(ctx.projectMemberRepository, 'getProjectMembersByUserId').mockResolvedValue(
        actor.projectRoles.map((role) => ({
          id: '00000000-0000-0000-0000-000000000000',
          projectId: role.projectId,
          userId: actor.userId,
          projectRoleId: role.projectRoleId,
          projectRole: { id: role.projectRoleId, name: role.projectRoleName },
        })),
      );
    }

    function deleteMemberRequest(
      pathProjectId: string,
      pathMemberId: string,
      authorizationHeader?: string,
    ) {
      const request = supertest(app).delete(
        `/api/v1/projects/${pathProjectId}/members/${pathMemberId}`,
      );
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request.send();
    }

    describe('on success', () => {
      it('returns 204 and deletes a Project Admin for Workspace Owner (bypass)', async () => {
        const response = await deleteMemberRequest(
          projectId,
          projectAdminMemberId,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectNoContentResponse(response);
        await expectMemberAbsent(projectAdminMemberId);
      });

      it('returns 204 and deletes a Developer for Workspace Owner', async () => {
        const response = await deleteMemberRequest(
          projectId,
          developerMemberId,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectNoContentResponse(response);
        await expectMemberAbsent(developerMemberId);
      });

      it('returns 204 when a Project Owner member removes a Developer', async () => {
        const response = await deleteMemberRequest(
          projectId,
          developerMemberId,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectNoContentResponse(response);
        await expectMemberAbsent(developerMemberId);
      });

      it('returns 204 when a Project Admin removes a Developer', async () => {
        const projectAdminMembership = await prisma.projectMember.findUniqueOrThrow({
          where: { id: projectAdminMemberId },
        });
        const actor: ActorContext = {
          ...workspaceAdminActor,
          projectRoles: [
            {
              projectId,
              projectRoleId: projectAdminMembership.projectRoleId,
              projectRoleName: ProjectRoleName.PROJECT_ADMIN,
            },
          ],
        };
        spyProjectRoles(actor);

        const response = await deleteMemberRequest(
          projectId,
          developerMemberId,
          tokenFor(ctx.tokenService, actor),
        );

        expectNoContentResponse(response);
        await expectMemberAbsent(developerMemberId);
      });
    });

    describe('on validation failure (400)', () => {
      it('returns 400 when the path project id is malformed', async () => {
        const response = await deleteMemberRequest(
          'not-a-uuid',
          developerMemberId,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectValidationError(response, ['projectId']);
      });

      it('returns 400 when the path member id is malformed', async () => {
        const response = await deleteMemberRequest(
          projectId,
          'not-a-uuid',
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectValidationError(response, ['memberId']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and does not remove the member', async () => {
        const response = await deleteMemberRequest(projectId, developerMemberId);

        expectAuthenticationRequired(response);
        const row = await prisma.projectMember.findUnique({ where: { id: developerMemberId } });
        expect(row).not.toBeNull();
      });
    });

    describe('on authorization failures (403)', () => {
      it.each([
        {
          case: 'Workspace Admin without a project role',
          // The admin user IS seeded as PROJECT_ADMIN in beforeEach. Spy to
          // simulate a Workspace Admin whose memberships are empty, so the
          // matrix lookup for `removeProjectMember` fails (no project role,
          // workspace Admin is not in the workspaceBypass set).
          getActor: () => workspaceAdminActor,
          actorMemberships: [] as {
            projectId: string;
            projectRoleId: string;
            projectRoleName: ProjectRoleName;
          }[],
        },
        {
          case: 'Developer member',
          getActor: () => workspaceDeveloperActor,
          actorMemberships: () => [
            {
              projectId,
              projectRoleId: developerProjectRoleId,
              projectRoleName: ProjectRoleName.DEVELOPER,
            },
          ],
        },
      ])('returns a forbidden error for $case', async ({ getActor, actorMemberships }) => {
        const actor = getActor();
        const memberships =
          typeof actorMemberships === 'function' ? actorMemberships() : actorMemberships;
        jest.spyOn(ctx.projectMemberRepository, 'getProjectMembersByUserId').mockResolvedValue(
          memberships.map((role) => ({
            id: '00000000-0000-0000-0000-000000000000',
            projectId: role.projectId,
            userId: actor.userId,
            projectRoleId: role.projectRoleId,
            projectRole: { id: role.projectRoleId, name: role.projectRoleName },
          })),
        );

        const response = await deleteMemberRequest(
          projectId,
          developerMemberId,
          tokenFor(ctx.tokenService, actor),
        );

        expectForbiddenError(response);
        const row = await prisma.projectMember.findUnique({ where: { id: developerMemberId } });
        expect(row).not.toBeNull();
      });
    });

    describe('on not found (404)', () => {
      it('returns a not-found error for an unknown member id', async () => {
        const response = await deleteMemberRequest(
          projectId,
          WELL_FORMED_UNKNOWN_UUID,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.projectMemberRepository.resourceName);
      });

      it('returns a not-found error when the member belongs to a different project', async () => {
        const response = await deleteMemberRequest(
          projectId,
          otherProjectMemberId,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectResourceNotFoundError(response, ctx.projectMemberRepository.resourceName);
      });
    });

    describe('on business rule violations (422)', () => {
      it('returns 422 when the target is the Project Owner member (owner-protection)', async () => {
        const response = await deleteMemberRequest(
          projectId,
          projectOwnerMemberId,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        const row = await prisma.projectMember.findUnique({ where: { id: projectOwnerMemberId } });
        expect(row).not.toBeNull();
      });

      it("returns 422 when the target is the actor's own membership (self-mutation)", async () => {
        // DELETE self-mutation for a non-Owner membership: developer owns the
        // project; Workspace Owner is enrolled as Project Admin and attempts to
        // remove themselves. WO bypass authorizes the call and skips the ladder,
        // so only the self-mutation rule rejects.
        await prisma.projectMember.deleteMany({ where: { projectId } });
        await seedProjectMembership(
          projectId,
          workspaceDeveloperActor.userId,
          ProjectRoleName.PROJECT_OWNER,
        );
        const selfMembership = await seedProjectMembership(
          projectId,
          workspaceOwnerActor.userId,
          ProjectRoleName.PROJECT_ADMIN,
        );

        const response = await deleteMemberRequest(
          projectId,
          selfMembership.id,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectBusinessRuleViolationError(response);
        const row = await prisma.projectMember.findUnique({
          where: { id: selfMembership.id },
        });
        expect(row).not.toBeNull();
      });

      it('returns 422 when a Project Admin attempts to remove a Project Admin target (ladder)', async () => {
        // Seed a second Project Admin so the Project Admin actor can target
        // another Project Admin without self-mutation.
        const secondAdminUserId = workspaceDeveloperActor.userId;
        await prisma.projectMember.deleteMany({ where: { userId: secondAdminUserId, projectId } });
        const secondAdmin = await seedProjectMembership(
          projectId,
          secondAdminUserId,
          ProjectRoleName.PROJECT_ADMIN,
        );

        const actor: ActorContext = {
          ...workspaceAdminActor,
          projectRoles: [
            {
              projectId,
              projectRoleId: projectAdminRoleId,
              projectRoleName: ProjectRoleName.PROJECT_ADMIN,
            },
          ],
        };
        spyProjectRoles(actor);

        const response = await deleteMemberRequest(
          projectId,
          secondAdmin.id,
          tokenFor(ctx.tokenService, actor),
        );

        expectBusinessRuleViolationError(response);
        const row = await prisma.projectMember.findUnique({ where: { id: secondAdmin.id } });
        expect(row).not.toBeNull();
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when deleteProjectMember throws', async () => {
        jest
          .spyOn(ctx.projectMemberRepository, 'deleteProjectMember')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await deleteMemberRequest(
          projectId,
          developerMemberId,
          tokenFor(ctx.tokenService, workspaceOwnerActor),
        );

        expectInternalServerError(response);
      });
    });
  });
});
