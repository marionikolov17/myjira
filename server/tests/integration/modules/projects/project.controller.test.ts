import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import supertest from 'supertest';

import { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { prisma } from '@/common/lib/prisma';
import { ProjectMemberRepository, ProjectRoleName } from '@/modules/project-members';
import { IssuePriority, IssueStatus } from '@/generated/prisma/enums';

import { createTestUsers } from '../../fixtures/users.fixtures';
import { ensureWorkspaceRolesSeeded } from '../../fixtures/workspace-roles.fixtures';
import { ensureProjectRolesSeeded } from '../../fixtures/project-members.fixtures';
import {
  fetchPersistedUsers,
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

import { describeListEndpoint } from '../../suites/list-endpoint.suite';

import {
  createProjectsTestContext,
  fetchProjectRoleIdByName,
  ProjectsTestContext,
  seedProject,
  testUsers,
} from './project.controller.fixtures';
import {
  expectNoContentResponse,
  expectNoProjectWithName,
  expectProjectAbsent,
  expectProjectAndOwnerMemberPersisted,
  expectProjectResponse,
  expectProjectResponseById,
} from './project.controller.assertions';
import { ProjectRepository } from '@/modules/projects';

function toProjectRoles(
  memberships: { projectId: string; projectRoleId: string; projectRoleName: ProjectRoleName }[],
): ActorContext['projectRoles'] {
  return memberships.map((membership) => ({
    projectId: membership.projectId,
    projectRoleId: membership.projectRoleId,
    projectRoleName: membership.projectRoleName,
  }));
}

describe('Projects Controller', () => {
  let app: Application;
  let ctx: ProjectsTestContext;

  beforeAll(async () => {
    ctx = createProjectsTestContext();
    app = ctx.app;

    await ensureWorkspaceRolesSeeded();
    await ensureProjectRolesSeeded();
  });

  describe('POST /', () => {
    let ownerActor: ActorContext;
    let adminActor: ActorContext;
    let developerActor: ActorContext;

    beforeAll(async () => {
      await createTestUsers(testUsers);

      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      ownerActor = userToActorContext(owner, []);
      adminActor = userToActorContext(admin, []);
      developerActor = userToActorContext(developer, []);
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    afterEach(async () => {
      // Each test seeds its own project; wipe between cases.
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
    });

    function createProjectRequest(
      body: Record<string, unknown> | undefined | unknown[],
      authorizationHeader?: string,
    ) {
      const request = supertest(app).post('/api/v1/projects');

      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }

      return request.send(body);
    }

    describe('on success', () => {
      it.each([
        { case: 'Workspace Owner', getActor: () => ownerActor },
        { case: 'Workspace Admin', getActor: () => adminActor },
      ])(
        'creates a project and bootstraps the actor as Project Owner for a $case',
        async ({ getActor }) => {
          const actor = getActor();
          const response = await createProjectRequest(
            { name: 'Alpha', description: 'Alpha description' },
            tokenFor(ctx.tokenService, actor),
          );

          expectProjectResponse(response, 201, {
            name: 'Alpha',
            description: 'Alpha description',
            creatorId: actor.userId,
          });

          await expectProjectAndOwnerMemberPersisted(response.body.data.id, {
            name: 'Alpha',
            description: 'Alpha description',
            creatorId: actor.userId,
          });
        },
      );

      it('allows duplicate project names', async () => {
        const first = await createProjectRequest(
          { name: 'Duplicate', description: 'first' },
          tokenFor(ctx.tokenService, ownerActor),
        );
        expect(first.status).toBe(201);

        const second = await createProjectRequest(
          { name: 'Duplicate', description: 'second' },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectProjectResponse(second, 201, {
          name: 'Duplicate',
          description: 'second',
          creatorId: ownerActor.userId,
        });

        const persisted = await prisma.project.findMany({ where: { name: 'Duplicate' } });
        expect(persisted).toHaveLength(2);
      });
    });

    describe('on validation failure (400)', () => {
      it.each<{
        case: string;
        body: Record<string, unknown> | undefined | unknown[];
        expectedFields: string[];
      }>([
        {
          case: 'name is missing',
          body: { description: 'd' },
          expectedFields: ['name'],
        },
        {
          case: 'description is missing',
          body: { name: 'n' },
          expectedFields: ['description'],
        },
        {
          case: 'name is empty',
          body: { name: '', description: 'd' },
          expectedFields: ['name'],
        },
        {
          case: 'description is empty',
          body: { name: 'n', description: '' },
          expectedFields: ['description'],
        },
        {
          case: 'both fields are missing',
          body: {},
          expectedFields: ['name', 'description'],
        },
        {
          case: 'request body is undefined',
          body: undefined,
          expectedFields: ['name', 'description'],
        },
        {
          case: 'request body is not an object',
          body: [],
          expectedFields: ['name', 'description'],
        },
        {
          case: 'disallowed extra field',
          body: { name: 'n', description: 'd', creatorId: '11111111-1111-4111-8111-111111111111' },
          expectedFields: ['creatorId'],
        },
      ])('returns a validation error when $case', async ({ body, expectedFields }) => {
        const response = await createProjectRequest(body, tokenFor(ctx.tokenService, ownerActor));

        expectValidationError(response, expectedFields);
        await expectNoProjectWithName((body as { name?: string })?.name ?? '');
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and does not create a project', async () => {
        const response = await createProjectRequest({ name: 'Nope', description: 'nope' });

        expectAuthenticationRequired(response);
        await expectNoProjectWithName('Nope');
      });
    });

    describe('on authorization failures (403)', () => {
      it('returns a forbidden error for a Developer actor', async () => {
        const response = await createProjectRequest(
          { name: 'Forbidden', description: 'forbidden' },
          tokenFor(ctx.tokenService, developerActor),
        );

        expectForbiddenError(response);
        await expectNoProjectWithName('Forbidden');
      });
    });

    describe('on transaction rollback (500)', () => {
      it.each([
        {
          case: 'the project repository createProject throws',
          arrange: () => {
            jest
              .spyOn(ProjectRepository.prototype, 'createProject')
              .mockRejectedValueOnce(new Error('project write failure'));
          },
        },
        {
          case: 'the project member repository createProjectMember throws',
          arrange: () => {
            jest
              .spyOn(ProjectMemberRepository.prototype, 'createProjectMember')
              .mockRejectedValueOnce(new Error('member write failure'));
          },
        },
      ])(
        'returns an internal server error and does not persist the project when $case',
        async ({ arrange }) => {
          arrange();

          const response = await createProjectRequest(
            { name: 'Rollback', description: 'Rollback description' },
            tokenFor(ctx.tokenService, ownerActor),
          );

          expectInternalServerError(response);
          await expectNoProjectWithName('Rollback');
        },
      );
    });
  });

  describe('GET /', () => {
    const totalProjects = 25;
    const pageSize = 10;

    let ownerActor: ActorContext;
    let adminActor: ActorContext;
    let developerActor: ActorContext;

    let seededProjects: { id: string; name: string; description: string; creatorId: string }[] = [];
    let developerMemberProjects: string[] = [];

    beforeAll(async () => {
      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      // Seed 25 projects — the owner is the creator of all of them; project
      // membership is seeded separately below.
      seededProjects = [];
      for (let i = 0; i < totalProjects; i++) {
        const creatorId = i < 15 ? owner.id : admin.id;
        const project = await seedProject(
          creatorId,
          `List Project ${String(i).padStart(2, '0')}`,
          `List project ${i} description`,
        );
        seededProjects.push(project);
      }

      const projectOwnerRoleId = await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER);
      const developerProjectRoleId = await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER);

      // Owner is a project member of the first 3 projects.
      const ownerMemberRows = seededProjects.slice(0, 3);
      for (const project of ownerMemberRows) {
        await prisma.projectMember.create({
          data: { projectId: project.id, userId: owner.id, projectRoleId: projectOwnerRoleId },
        });
      }

      // Developer is a project member of 5 specific projects.
      const developerMemberRows = seededProjects.slice(5, 10);
      for (const project of developerMemberRows) {
        await prisma.projectMember.create({
          data: {
            projectId: project.id,
            userId: developer.id,
            projectRoleId: developerProjectRoleId,
          },
        });
      }
      developerMemberProjects = developerMemberRows.map((p) => p.id);

      ownerActor = userToActorContext(
        owner,
        toProjectRoles(
          ownerMemberRows.map((p) => ({
            projectId: p.id,
            projectRoleId: projectOwnerRoleId,
            projectRoleName: ProjectRoleName.PROJECT_OWNER,
          })),
        ),
      );
      adminActor = userToActorContext(admin, []);
      developerActor = userToActorContext(
        developer,
        toProjectRoles(
          developerMemberRows.map((p) => ({
            projectId: p.id,
            projectRoleId: developerProjectRoleId,
            projectRoleName: ProjectRoleName.DEVELOPER,
          })),
        ),
      );
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    describeListEndpoint({
      path: '/api/v1/projects',
      getApp: () => app,
      getTokenService: () => ctx.tokenService,
      totalItems: totalProjects,
      pageSize,
      defaults: { page: 1, pageSize: 10 },
      getDefaultActor: () => ownerActor,
      // Workspace owners/admins see the full population; the Developer actor is
      // scoped to its 5 member projects, so `expectedIds` doubles as the
      // end-to-end proof that per-actor scoping is wired for this resource.
      getAuthorizedActorMatrix: () => [
        { label: 'Workspace Owner', actor: ownerActor },
        { label: 'Workspace Admin', actor: adminActor },
        {
          label: 'Developer (scoped to memberships)',
          actor: developerActor,
          expectedIds: developerMemberProjects,
        },
      ],
      getFilterProbe: () => ({
        label: 'filter[creatorId] (uuid eq)',
        query: { 'filter[creatorId]': adminActor.userId, pageSize: '100' },
        expectedIds: seededProjects
          .filter((p) => p.creatorId === adminActor.userId)
          .map((p) => p.id),
      }),
      getEmptyEnvelopeQuery: () => ({
        'filter[creatorId]': '11111111-1111-4111-8111-111111111111',
      }),
      getSortProbe: () => ({
        query: { sort: '-createdAt', pageSize: '100' },
        getExpectedIdsInOrder: async () =>
          (
            await prisma.project.findMany({
              orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
              select: { id: true },
            })
          ).map((p) => p.id),
      }),
      validationProbe: { query: { sort: 'description' }, expectedFields: ['sort'] },
      getWorkspaceRoleRepository: () => ctx.workspaceRoleRepository,
      arrangeRepositoryFailure: () => {
        jest
          .spyOn(ctx.projectRepository, 'findProjects')
          .mockRejectedValueOnce(new Error('database unavailable'));
      },
    });
  });

  describe('GET /:id', () => {
    let ownerActor: ActorContext;
    let adminActor: ActorContext;
    let developerNonMemberActor: ActorContext;
    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      const project = await seedProject(owner.id, 'Target Project', 'Target description');
      projectId = project.id;

      // No project memberships are seeded in the DB. For member-type actors we
      // use `getProjectMembersByUserId` spies to shape `actor.projectRoles` on
      // each test. The base `developer` user naturally has no membership, so
      // the "non-member Developer" case does not need a spy.
      ownerActor = userToActorContext(owner, []);
      adminActor = userToActorContext(admin, []);
      developerNonMemberActor = userToActorContext(developer, []);
      projectOwnerActor = userToActorContext(developer, [
        {
          projectId,
          projectRoleId: await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER),
          projectRoleName: ProjectRoleName.PROJECT_OWNER,
        },
      ]);
      projectAdminActor = userToActorContext(developer, [
        {
          projectId,
          projectRoleId: await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN),
          projectRoleName: ProjectRoleName.PROJECT_ADMIN,
        },
      ]);
      projectDeveloperActor = userToActorContext(developer, [
        {
          projectId,
          projectRoleId: await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER),
          projectRoleName: ProjectRoleName.DEVELOPER,
        },
      ]);
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    function getProjectById(id: string, authorizationHeader?: string) {
      const request = supertest(app).get(`/api/v1/projects/${id}`);
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request;
    }

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

    describe('on success', () => {
      it.each([
        { case: 'Workspace Owner (bypass)', getActor: () => ownerActor, member: false },
        { case: 'Workspace Admin (bypass)', getActor: () => adminActor, member: false },
        { case: 'Project Owner member', getActor: () => projectOwnerActor, member: true },
        { case: 'Project Admin member', getActor: () => projectAdminActor, member: true },
        { case: 'Developer member', getActor: () => projectDeveloperActor, member: true },
      ])('returns the project resource for a $case', async ({ getActor, member }) => {
        const actor = getActor();
        if (member) {
          spyProjectRoles(actor);
        }

        const response = await getProjectById(projectId, tokenFor(ctx.tokenService, actor));

        expectProjectResponseById(response, {
          id: projectId,
          name: 'Target Project',
          description: 'Target description',
          creatorId: ownerActor.userId,
        });
      });
    });

    describe('on validation failure (400)', () => {
      it('returns a 400 when the path id is not a uuid', async () => {
        const response = await getProjectById('not-a-uuid', tokenFor(ctx.tokenService, ownerActor));

        expectValidationError(response, ['id']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error', async () => {
        const response = await getProjectById(projectId);
        expectAuthenticationRequired(response);
      });
    });

    describe('on authorization failures (403)', () => {
      it('returns 403 for a Developer actor who is not a member of the project', async () => {
        const response = await getProjectById(
          projectId,
          tokenFor(ctx.tokenService, developerNonMemberActor),
        );

        expectForbiddenError(response);
      });
    });

    describe('on not found (404)', () => {
      it('returns 404 for a well-formed id with no matching project', async () => {
        const response = await getProjectById(
          '11111111-1111-4111-8111-111111111111',
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectResourceNotFoundError(response, ctx.projectRepository.resourceName);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when the project repository throws', async () => {
        jest
          .spyOn(ctx.projectRepository, 'getProjectById')
          .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await getProjectById(projectId, tokenFor(ctx.tokenService, ownerActor));

        expectInternalServerError(response);
      });
    });
  });

  describe('PATCH /:id', () => {
    let ownerActor: ActorContext;
    let adminActor: ActorContext;
    let developerNonMemberActor: ActorContext;
    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;
    const projectOriginalName = 'Updatable Project';
    const projectOriginalDescription = 'Updatable description';

    beforeAll(async () => {
      await createTestUsers(testUsers);
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    beforeEach(async () => {
      // Reset the project between tests so each test starts from the original state.
      // No project memberships are seeded; member-type actors use spies to shape
      // `actor.projectRoles` on each test. The base `developer` user is naturally
      // a non-member.
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();

      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      const project = await seedProject(owner.id, projectOriginalName, projectOriginalDescription);
      projectId = project.id;

      ownerActor = userToActorContext(owner, []);
      adminActor = userToActorContext(admin, []);
      developerNonMemberActor = userToActorContext(developer, []);
      projectOwnerActor = userToActorContext(developer, [
        {
          projectId,
          projectRoleId: await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER),
          projectRoleName: ProjectRoleName.PROJECT_OWNER,
        },
      ]);
      projectAdminActor = userToActorContext(developer, [
        {
          projectId,
          projectRoleId: await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN),
          projectRoleName: ProjectRoleName.PROJECT_ADMIN,
        },
      ]);
      projectDeveloperActor = userToActorContext(developer, [
        {
          projectId,
          projectRoleId: await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER),
          projectRoleName: ProjectRoleName.DEVELOPER,
        },
      ]);
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

    function updateProjectRequest(
      id: string,
      body: Record<string, unknown> | undefined | unknown[],
      authorizationHeader?: string,
    ) {
      const request = supertest(app).patch(`/api/v1/projects/${id}`);
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request.send(body);
    }

    describe('on success', () => {
      it('updates both fields for Workspace Owner (bypass)', async () => {
        const response = await updateProjectRequest(
          projectId,
          { name: 'Renamed', description: 'Renamed description' },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectProjectResponseById(response, {
          id: projectId,
          name: 'Renamed',
          description: 'Renamed description',
          creatorId: ownerActor.userId,
        });

        const persisted = await prisma.project.findUnique({ where: { id: projectId } });
        expect(persisted?.name).toBe('Renamed');
        expect(persisted?.description).toBe('Renamed description');
      });

      it('updates both fields for Project Owner member', async () => {
        spyProjectRoles(projectOwnerActor);

        const response = await updateProjectRequest(
          projectId,
          { name: 'ByOwner', description: 'byOwner' },
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectProjectResponseById(response, {
          id: projectId,
          name: 'ByOwner',
          description: 'byOwner',
          creatorId: ownerActor.userId,
        });
      });

      it('updates only name and leaves description unchanged', async () => {
        const response = await updateProjectRequest(
          projectId,
          { name: 'OnlyName' },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectProjectResponseById(response, {
          id: projectId,
          name: 'OnlyName',
          description: projectOriginalDescription,
          creatorId: ownerActor.userId,
        });
      });

      it('updates only description and leaves name unchanged', async () => {
        const response = await updateProjectRequest(
          projectId,
          { description: 'OnlyDesc' },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectProjectResponseById(response, {
          id: projectId,
          name: projectOriginalName,
          description: 'OnlyDesc',
          creatorId: ownerActor.userId,
        });
      });
    });

    describe('on validation failure (400)', () => {
      it('returns a 400 when the path id is not a uuid', async () => {
        const response = await updateProjectRequest(
          'not-a-uuid',
          { name: 'x' },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectValidationError(response, ['id']);
      });

      it.each<{
        case: string;
        body: Record<string, unknown> | undefined | unknown[];
      }>([
        { case: 'empty payload', body: {} },
        { case: 'name is empty', body: { name: '' } },
        { case: 'description is empty', body: { description: '' } },
        { case: 'unknown field (strict object)', body: { foo: 'bar' } },
        { case: 'request body is undefined', body: undefined },
        { case: 'request body is not an object', body: [] },
      ])('returns a 400 validation error when $case', async ({ body }) => {
        const response = await updateProjectRequest(
          projectId,
          body,
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectValidationError(response);

        const persisted = await prisma.project.findUnique({ where: { id: projectId } });
        expect(persisted?.name).toBe(projectOriginalName);
        expect(persisted?.description).toBe(projectOriginalDescription);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and does not modify the project', async () => {
        const response = await updateProjectRequest(projectId, { name: 'nope' });

        expectAuthenticationRequired(response);

        const persisted = await prisma.project.findUnique({ where: { id: projectId } });
        expect(persisted?.name).toBe(projectOriginalName);
      });
    });

    describe('on authorization failures (403)', () => {
      it.each([
        {
          case: 'Workspace Admin without Project Owner role',
          getActor: () => adminActor,
        },
        {
          case: 'Project Admin member',
          getActor: () => projectAdminActor,
        },
        {
          case: 'Developer member',
          getActor: () => projectDeveloperActor,
        },
        {
          case: 'Developer non-member',
          getActor: () => developerNonMemberActor,
        },
      ])('returns a forbidden error for $case', async ({ getActor }) => {
        const actor = getActor();
        if (actor === projectAdminActor || actor === projectDeveloperActor) {
          spyProjectRoles(actor);
        }

        const response = await updateProjectRequest(
          projectId,
          { name: 'forbidden' },
          tokenFor(ctx.tokenService, actor),
        );

        expectForbiddenError(response);

        const persisted = await prisma.project.findUnique({ where: { id: projectId } });
        expect(persisted?.name).toBe(projectOriginalName);
      });
    });

    describe('on not found (404)', () => {
      it('returns 404 for a well-formed id with no matching project', async () => {
        const response = await updateProjectRequest(
          '11111111-1111-4111-8111-111111111111',
          { name: 'ghost' },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectResourceNotFoundError(response, ctx.projectRepository.resourceName);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it.each([
        {
          case: 'the project member repository getProjectMembersByUserId throws',
          arrange: () => {
            jest
              .spyOn(ctx.projectMemberRepository, 'getProjectMembersByUserId')
              .mockRejectedValueOnce(new Error('database unavailable'));
          },
        },
        {
          case: 'the project repository updateProject throws',
          arrange: () => {
            jest
              .spyOn(ctx.projectRepository, 'updateProject')
              .mockRejectedValueOnce(new Error('database unavailable'));
          },
        },
      ])('returns an internal server error when $case', async ({ arrange }) => {
        arrange();

        const response = await updateProjectRequest(
          projectId,
          { name: 'boom' },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectInternalServerError(response);
      });
    });
  });

  describe('DELETE /:id', () => {
    let ownerActor: ActorContext;
    let adminActor: ActorContext;
    let developerNonMemberActor: ActorContext;
    let projectOwnerActor: ActorContext;
    let projectAdminActor: ActorContext;
    let projectDeveloperActor: ActorContext;

    let projectId: string;

    beforeAll(async () => {
      await createTestUsers(testUsers);
    });

    afterAll(async () => {
      await prisma.subtask.deleteMany();
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    beforeEach(async () => {
      await prisma.subtask.deleteMany();
      await prisma.issue.deleteMany();
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();

      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
      if (!owner || !admin || !developer) {
        throw new Error('Expected seeded users to exist');
      }

      const project = await seedProject(owner.id, 'Deletable', 'deletable description');
      projectId = project.id;

      // No project memberships are seeded; member-type actors use spies.
      ownerActor = userToActorContext(owner, []);
      adminActor = userToActorContext(admin, []);
      developerNonMemberActor = userToActorContext(developer, []);
      projectOwnerActor = userToActorContext(developer, [
        {
          projectId,
          projectRoleId: await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER),
          projectRoleName: ProjectRoleName.PROJECT_OWNER,
        },
      ]);
      projectAdminActor = userToActorContext(developer, [
        {
          projectId,
          projectRoleId: await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN),
          projectRoleName: ProjectRoleName.PROJECT_ADMIN,
        },
      ]);
      projectDeveloperActor = userToActorContext(developer, [
        {
          projectId,
          projectRoleId: await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER),
          projectRoleName: ProjectRoleName.DEVELOPER,
        },
      ]);
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

    function deleteProjectRequest(id: string, authorizationHeader?: string) {
      const request = supertest(app).delete(`/api/v1/projects/${id}`);
      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }
      return request.send();
    }

    describe('on success', () => {
      it('returns 204 and deletes the project for Workspace Owner (bypass)', async () => {
        const response = await deleteProjectRequest(
          projectId,
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectNoContentResponse(response);
        await expectProjectAbsent(projectId);
      });

      it('returns 204 and deletes the project for Project Owner member', async () => {
        spyProjectRoles(projectOwnerActor);

        const response = await deleteProjectRequest(
          projectId,
          tokenFor(ctx.tokenService, projectOwnerActor),
        );

        expectNoContentResponse(response);
        await expectProjectAbsent(projectId);
      });

      it('cascades removal to project_members, issues, and subtasks', async () => {
        const [owner, , developer] = await fetchPersistedUsers(testUsers);
        if (!owner || !developer) {
          throw new Error('Expected seeded users to exist');
        }

        // Seed an issue and a subtask referencing the target project.
        const issue = await prisma.issue.create({
          data: {
            title: 'Issue 1',
            description: 'issue 1 description',
            status: IssueStatus.ToDo,
            priority: IssuePriority.Low,
            creatorId: owner.id,
            projectId,
            assigneeId: developer.id,
          },
        });

        await prisma.subtask.create({
          data: {
            title: 'Subtask 1',
            description: 'subtask 1 description',
            status: IssueStatus.ToDo,
            creatorId: owner.id,
            issueId: issue.id,
            assigneeId: developer.id,
          },
        });

        const response = await deleteProjectRequest(
          projectId,
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectNoContentResponse(response);

        expect(await prisma.project.count({ where: { id: projectId } })).toBe(0);
        expect(await prisma.projectMember.count({ where: { projectId } })).toBe(0);
        expect(await prisma.issue.count({ where: { projectId } })).toBe(0);
        expect(await prisma.subtask.count({ where: { issueId: issue.id } })).toBe(0);
      });
    });

    describe('on validation failure (400)', () => {
      it('returns 400 when the path id is not a uuid', async () => {
        const response = await deleteProjectRequest(
          'not-a-uuid',
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectValidationError(response, ['id']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and does not delete the project', async () => {
        const response = await deleteProjectRequest(projectId);

        expectAuthenticationRequired(response);

        const persisted = await prisma.project.findUnique({ where: { id: projectId } });
        expect(persisted).not.toBeNull();
      });
    });

    describe('on authorization failures (403)', () => {
      it.each([
        { case: 'Workspace Admin without Project Owner role', getActor: () => adminActor },
        { case: 'Project Admin member', getActor: () => projectAdminActor },
        { case: 'Developer member', getActor: () => projectDeveloperActor },
        { case: 'Developer non-member', getActor: () => developerNonMemberActor },
      ])('returns a forbidden error for $case', async ({ getActor }) => {
        const actor = getActor();
        if (actor === projectAdminActor || actor === projectDeveloperActor) {
          spyProjectRoles(actor);
        }

        const response = await deleteProjectRequest(projectId, tokenFor(ctx.tokenService, actor));

        expectForbiddenError(response);

        const persisted = await prisma.project.findUnique({ where: { id: projectId } });
        expect(persisted).not.toBeNull();
      });
    });

    describe('on not found (404)', () => {
      it('returns 404 for a well-formed id with no matching project', async () => {
        const response = await deleteProjectRequest(
          '11111111-1111-4111-8111-111111111111',
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectResourceNotFoundError(response, ctx.projectRepository.resourceName);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it.each([
        {
          case: 'the project member repository getProjectMembersByUserId throws',
          arrange: () => {
            jest
              .spyOn(ctx.projectMemberRepository, 'getProjectMembersByUserId')
              .mockRejectedValueOnce(new Error('database unavailable'));
          },
        },
        {
          case: 'the project repository deleteProject throws',
          arrange: () => {
            jest
              .spyOn(ctx.projectRepository, 'deleteProject')
              .mockRejectedValueOnce(new Error('database unavailable'));
          },
        },
      ])('returns an internal server error when $case', async ({ arrange }) => {
        arrange();

        const response = await deleteProjectRequest(
          projectId,
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectInternalServerError(response);
      });
    });
  });
});
