import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import supertest from 'supertest';

import { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { ProjectRoleName } from '@/modules/project-roles';
import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { prisma } from '@/common/lib/prisma';
import { UserStatus } from '@/generated/prisma/enums';
import { User } from '@/generated/prisma/client';

import { createTestUsers } from '../../fixtures/users.fixtures';
import { ensureWorkspaceRolesSeeded } from '../../fixtures/workspace-roles.fixtures';
import {
  SeededProjectMembership,
  seedProjectMembership,
} from '../../fixtures/project-members.fixtures';
import { seedProject } from '../../fixtures/projects.fixtures';
import { ensureProjectRolesSeeded } from '../../fixtures/project-roles.fixtures';
import {
  fetchPersistedUsers,
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
import { expectPaginatedEnvelope } from '../../assertions/list.assertions';

import { describeListEndpoint } from '../../suites/list-endpoint.suite';

import {
  createExpiredToken,
  createTokenWithWrongSecret,
  createUsersTestContext,
  fetchRawUserByEmail,
  fetchWorkspaceRoleIdByName,
  seedUserWithRole,
  testUsers,
  UsersTestContext,
} from './user.controller.fixtures';
import {
  expectActorContextResponse,
  expectCreatedUserResponse,
  expectPendingUserPersisted,
  expectUpdatedUserRoleResponse,
  expectUserDetailsResponse,
  extractActivationToken,
} from './user.controller.assertions';

describe('Users Controller', () => {
  let app: Application;
  let ctx: UsersTestContext;

  beforeAll(async () => {
    ctx = createUsersTestContext();
    app = ctx.app;

    await ensureWorkspaceRolesSeeded();
    await ensureProjectRolesSeeded();
  });

  describe('GET /me', () => {
    let ownerActor: ActorContext;
    let adminActor: ActorContext;
    let developerActor: ActorContext;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);

      if (!owner || !admin || !developer) {
        throw new Error('Expected users to be persisted');
      }

      const project = await seedProject(
        owner.id,
        'Users controller test project',
        'Users controller test project description',
      );
      const membership: SeededProjectMembership = await seedProjectMembership(
        project.id,
        owner.id,
        ProjectRoleName.PROJECT_OWNER,
      );

      ownerActor = userToActorContext(owner, [
        {
          projectId: membership.projectId,
          projectRoleId: membership.projectRoleId,
          projectRoleName: ProjectRoleName.PROJECT_OWNER,
        },
      ]);
      adminActor = userToActorContext(admin, []);
      developerActor = userToActorContext(developer, []);
    });

    afterAll(async () => {
      await prisma.projectMember.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    });

    function getMe(authorizationHeader?: string) {
      const request = supertest(app).get('/api/v1/users/me');

      if (authorizationHeader === undefined) {
        return request;
      }

      return request.set('Authorization', authorizationHeader);
    }

    describe('on success', () => {
      it.each([
        { actor: 'Owner', getActor: () => ownerActor, getExpectedActor: () => ownerActor },
        { actor: 'Admin', getActor: () => adminActor, getExpectedActor: () => adminActor },
        {
          actor: 'Developer',
          getActor: () => developerActor,
          getExpectedActor: () => developerActor,
        },
      ])('returns the actor context for a $actor', async ({ getActor, getExpectedActor }) => {
        const response = await getMe(tokenFor(ctx.tokenService, getActor()));

        expectActorContextResponse(response, getExpectedActor());
      });

      it('returns the project roles for a user that is a member of a project', async () => {
        const response = await getMe(tokenFor(ctx.tokenService, ownerActor));

        expect(response.status).toBe(200);
        expect(response.body.data.projectRoles).toEqual(ownerActor.projectRoles);
        expect(response.body.data.projectRoles).toHaveLength(1);
      });

      it('returns an empty project roles array for a user with no memberships', async () => {
        const response = await getMe(tokenFor(ctx.tokenService, adminActor));

        expect(response.status).toBe(200);
        expect(response.body.data.projectRoles).toEqual([]);
      });
    });

    describe('on unauthenticated request', () => {
      it('returns an authentication required error when the Authorization header is missing', async () => {
        const response = await getMe();

        expectAuthenticationRequired(response);
      });

      it('returns an authentication required error when the token is invalid', async () => {
        const response = await getMe(
          createTokenWithWrongSecret(ownerActor.userId, ownerActor.workspaceRole.id),
        );

        expectAuthenticationRequired(response);
      });

      it('returns an authentication required error when the token is expired', async () => {
        const response = await getMe(
          createExpiredToken(ownerActor.userId, ownerActor.workspaceRole.id),
        );

        expectAuthenticationRequired(response);
      });

      it.each([
        { case: 'a garbage bearer token', header: 'Bearer not-a-real-token' },
        { case: 'a non-Bearer scheme', header: 'Basic dXNlcjpwYXNz' },
        { case: 'a bare token with no scheme', header: 'not-a-real-token' },
        { case: 'a Bearer scheme with no token', header: 'Bearer' },
      ])('returns an authentication required error for $case', async ({ header }) => {
        const response = await getMe(header);

        expectAuthenticationRequired(response);
      });
    });

    describe('on a valid token whose principal no longer exists', () => {
      it.each([
        {
          case: 'the user no longer exists',
          arrange: () => jest.spyOn(ctx.userRepository, 'getUserById').mockResolvedValue(null),
        },
        {
          case: 'the workspace role no longer exists',
          arrange: () =>
            jest.spyOn(ctx.workspaceRoleRepository, 'getWorkspaceRoleById').mockResolvedValue(null),
        },
      ])('returns an authentication required error when $case', async ({ arrange }) => {
        arrange();

        const response = await getMe(tokenFor(ctx.tokenService, ownerActor));

        expectAuthenticationRequired(response);
      });
    });

    describe('on unexpected dependency failure', () => {
      it.each([
        {
          case: 'the user repository throws',
          arrange: () =>
            jest
              .spyOn(ctx.userRepository, 'getUserById')
              .mockRejectedValue(new Error('database unavailable')),
        },
        {
          case: 'the workspace role repository throws',
          arrange: () =>
            jest
              .spyOn(ctx.workspaceRoleRepository, 'getWorkspaceRoleById')
              .mockRejectedValue(new Error('database unavailable')),
        },
        {
          case: 'the project member repository throws',
          arrange: () =>
            jest
              .spyOn(ctx.projectMemberRepository, 'getProjectMembersByUserId')
              .mockRejectedValue(new Error('database unavailable')),
        },
      ])('returns an internal server error when $case', async ({ arrange }) => {
        arrange();

        const response = await getMe(tokenFor(ctx.tokenService, ownerActor));

        expectInternalServerError(response);
      });
    });
  });

  describe('GET /', () => {
    const usersCount = 25;
    const pageSize = 10;

    const ownerUsersCount = 10;
    const adminUsersCount = 10;
    const developerUsersCount = 5;

    const oldDate = new Date('2020-01-01T00:00:00Z');
    const recentDate = new Date('2020-06-01T00:00:00Z');

    let ownerUsers: User[] = [];
    let adminUsers: User[] = [];
    let adminWorkspaceRoleId: string;

    let ownerActor: ActorContext;
    let adminActor: ActorContext;
    let developerActor: ActorContext;

    beforeAll(async () => {
      const ownerRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.OWNER);
      adminWorkspaceRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.ADMIN);
      const developerRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.DEVELOPER);

      if (!ownerRoleId || !adminWorkspaceRoleId || !developerRoleId) {
        throw new Error('Expected workspace roles to be seeded');
      }

      ownerUsers = await prisma.user.createManyAndReturn({
        data: Array.from({ length: ownerUsersCount }, (_, i) => {
          return {
            email: `owner-user-${i}@example.com`,
            name: `Owner User ${i}`,
            workspaceRoleId: ownerRoleId,
            status: i < 5 ? UserStatus.Active : UserStatus.Pending,
            password: null as string | null,
            createdAt: i % 2 === 0 ? oldDate : recentDate,
          };
        }),
      });
      adminUsers = await prisma.user.createManyAndReturn({
        data: Array.from({ length: adminUsersCount }, (_, i) => {
          return {
            email: `admin-user-${i}@example.com`,
            name: `Admin User ${i}`,
            workspaceRoleId: adminWorkspaceRoleId,
            status: i < 5 ? UserStatus.Active : UserStatus.Pending,
            password: null as string | null,
            createdAt: i % 2 === 0 ? oldDate : recentDate,
          };
        }),
      });
      const developerUsers = await prisma.user.createManyAndReturn({
        data: Array.from({ length: developerUsersCount }, (_, i) => {
          return {
            email: `developer-user-${i}@example.com`,
            name: `Developer User ${i}`,
            workspaceRoleId: developerRoleId,
            status: UserStatus.Active,
            password: null as string | null,
            createdAt: recentDate,
          };
        }),
      });

      const activeOwnerUser = ownerUsers.find((user) => user.status === UserStatus.Active);
      const activeAdminUser = adminUsers.find((user) => user.status === UserStatus.Active);
      const activeDeveloperUser = developerUsers.find((user) => user.status === UserStatus.Active);

      if (!activeOwnerUser || !activeAdminUser || !activeDeveloperUser) {
        throw new Error(
          'Expected an active user to be seeded for each of Owner, Admin, and Developer',
        );
      }

      ownerActor = userToActorContext(
        {
          id: activeOwnerUser.id,
          workspaceRoleId: activeOwnerUser.workspaceRoleId,
          workspaceRoleName: WorkspaceRoleName.OWNER,
        },
        [],
      );
      adminActor = userToActorContext(
        {
          id: activeAdminUser.id,
          workspaceRoleId: activeAdminUser.workspaceRoleId,
          workspaceRoleName: WorkspaceRoleName.ADMIN,
        },
        [],
      );
      developerActor = userToActorContext(
        {
          id: activeDeveloperUser.id,
          workspaceRoleId: activeDeveloperUser.workspaceRoleId,
          workspaceRoleName: WorkspaceRoleName.DEVELOPER,
        },
        [],
      );
    });

    afterAll(async () => {
      await prisma.user.deleteMany();
    });

    describeListEndpoint({
      path: '/api/v1/users',
      getApp: () => app,
      getTokenService: () => ctx.tokenService,
      totalItems: usersCount,
      pageSize,
      defaults: { page: 1, pageSize: 10 },
      getDefaultActor: () => ownerActor,
      // Users list is global — every workspace role sees the full population,
      // so no entry sets `expectedIds` (envelope-only assertion is enough).
      getAuthorizedActorMatrix: () => [
        { label: 'Owner', actor: ownerActor },
        { label: 'Admin', actor: adminActor },
        { label: 'Developer', actor: developerActor },
      ],
      getFilterProbe: () => ({
        label: 'filter[workspaceRoleId] (uuid eq)',
        query: { 'filter[workspaceRoleId]': adminWorkspaceRoleId, pageSize: '100' },
        expectedIds: adminUsers.map((user) => user.id),
      }),
      getEmptyEnvelopeQuery: () => ({
        'filter[workspaceRoleId]': '11111111-1111-4111-8111-111111111111',
      }),
      getSortProbe: () => ({
        query: { sort: '-createdAt', pageSize: '100' },
        getExpectedIdsInOrder: async () =>
          (
            await prisma.user.findMany({
              orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
              select: { id: true },
            })
          ).map((user) => user.id),
      }),
      validationProbe: { query: { sort: 'disallowed' }, expectedFields: ['sort'] },
      getWorkspaceRoleRepository: () => ctx.workspaceRoleRepository,
      arrangeRepositoryFailure: () => {
        jest
          .spyOn(ctx.userRepository, 'findUsers')
          .mockRejectedValue(new Error('database unavailable'));
      },
    });

    // Resource-specific response-shape check kept alongside the shared suite:
    // proves the users controller never leaks credential or activation material.
    describe('on safe fields', () => {
      it('every user in data exposes only safe fields and no credential material', async () => {
        const response = await supertest(app)
          .get('/api/v1/users')
          .set('Authorization', tokenFor(ctx.tokenService, ownerActor));

        expectPaginatedEnvelope(response);
        for (const user of response.body.data as Record<string, unknown>[]) {
          expect(user).toHaveProperty('id');
          expect(user).toHaveProperty('name');
          expect(user).toHaveProperty('email');
          expect(user).toHaveProperty('workspaceRoleId');
          expect(user).toHaveProperty('status');
          expect(user).toHaveProperty('createdAt');
          expect(user).toHaveProperty('updatedAt');
          expect(user).not.toHaveProperty('password');
          expect(user).not.toHaveProperty('activationTokenHash');
          expect(user).not.toHaveProperty('activationTokenExpiresAt');
        }
      });
    });
  });

  describe('POST /', () => {
    let ownerActor: ActorContext;
    let adminActor: ActorContext;
    let developerActor: ActorContext;

    beforeAll(async () => {
      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);

      if (!owner || !admin || !developer) {
        throw new Error('Expected users to be persisted');
      }

      ownerActor = userToActorContext(owner, []);
      adminActor = userToActorContext(admin, []);
      developerActor = userToActorContext(developer, []);
    });

    afterAll(async () => {
      await prisma.user.deleteMany();
    });

    function createUserRequest(
      body: Record<string, unknown> | undefined | unknown[],
      authorizationHeader?: string,
    ) {
      const request = supertest(app).post('/api/v1/users');

      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }

      return request.send(body);
    }

    function resolveRolePlaceholder(
      body: Record<string, unknown> | undefined | unknown[],
      roleId: string,
    ): Record<string, unknown> | undefined | unknown[] {
      if (body === undefined || Array.isArray(body)) {
        return body;
      }

      return Object.fromEntries(
        Object.entries(body).map(([key, value]) => {
          if (value === '__ROLE__') {
            return [key, roleId];
          }

          return [key, value];
        }),
      );
    }

    describe('on success', () => {
      it.each<{
        actorLabel: string;
        getActor: () => ActorContext;
        roleLabel: string;
        getRoleId: () => string;
        email: string;
      }>([
        {
          actorLabel: 'Workspace Owner',
          getActor: () => ownerActor,
          roleLabel: 'Developer',
          getRoleId: () => developerActor.workspaceRole.id,
          email: 'created-by-owner-developer@example.com',
        },
        {
          actorLabel: 'Workspace Owner',
          getActor: () => ownerActor,
          roleLabel: 'Admin',
          getRoleId: () => adminActor.workspaceRole.id,
          email: 'created-by-owner-admin@example.com',
        },
        {
          actorLabel: 'Workspace Admin',
          getActor: () => adminActor,
          roleLabel: 'Developer',
          getRoleId: () => developerActor.workspaceRole.id,
          email: 'created-by-admin-developer@example.com',
        },
        {
          actorLabel: 'Workspace Admin',
          getActor: () => adminActor,
          roleLabel: 'Admin',
          getRoleId: () => adminActor.workspaceRole.id,
          email: 'created-by-admin-admin@example.com',
        },
      ])(
        'creates a $roleLabel user when the actor is a $actorLabel',
        async ({ getActor, getRoleId, roleLabel, email }) => {
          const workspaceRoleId = getRoleId();
          const name = `Created ${roleLabel} User`;

          const response = await createUserRequest(
            { name, email, workspaceRoleId },
            tokenFor(ctx.tokenService, getActor()),
          );

          expectCreatedUserResponse(response, {
            name,
            email,
            workspaceRoleId,
            activationUrlBase: ctx.activationUrlBase,
          });

          const rawToken = extractActivationToken(response);
          await expectPendingUserPersisted(email, {
            workspaceRoleId,
            responseUserId: response.body.data.user.id,
            rawToken,
          });
        },
      );
    });

    describe('on authorization failures', () => {
      it('returns a forbidden error for a non-privileged actor and creates no user', async () => {
        const email = 'forbidden-create@example.com';

        const response = await createUserRequest(
          { name: 'Should Not Exist', email, workspaceRoleId: developerActor.workspaceRole.id },
          tokenFor(ctx.tokenService, developerActor),
        );

        expectForbiddenError(response);
        expect(await fetchRawUserByEmail(email)).toBeNull();
      });

      it('returns an authentication error for an unauthenticated request and creates no user', async () => {
        const email = 'unauthenticated-create@example.com';

        const response = await createUserRequest({
          name: 'Should Not Exist',
          email,
          workspaceRoleId: developerActor.workspaceRole.id,
        });

        expectAuthenticationRequired(response);
        expect(await fetchRawUserByEmail(email)).toBeNull();
      });
    });

    describe('on invalid request body', () => {
      it.each<{
        case: string;
        body: Record<string, unknown> | undefined | unknown[];
        expectedFields: string[];
      }>([
        {
          case: 'name is missing',
          body: { email: 'no-name@example.com', workspaceRoleId: '__ROLE__' },
          expectedFields: ['name'],
        },
        {
          case: 'email is missing',
          body: { name: 'No Email', workspaceRoleId: '__ROLE__' },
          expectedFields: ['email'],
        },
        {
          case: 'workspaceRoleId is missing',
          body: { name: 'No Role', email: 'no-role@example.com' },
          expectedFields: ['workspaceRoleId'],
        },
        {
          case: 'name is empty',
          body: { name: '', email: 'empty-name@example.com', workspaceRoleId: '__ROLE__' },
          expectedFields: ['name'],
        },
        {
          case: 'name is not a string',
          body: { name: 123, email: 'numeric-name@example.com', workspaceRoleId: '__ROLE__' },
          expectedFields: ['name'],
        },
        {
          case: 'email is malformed',
          body: { name: 'Bad Email', email: 'not-an-email', workspaceRoleId: '__ROLE__' },
          expectedFields: ['email'],
        },
        {
          case: 'email is null',
          body: { name: 'Null Email', email: null, workspaceRoleId: '__ROLE__' },
          expectedFields: ['email'],
        },
        {
          case: 'workspaceRoleId is not a uuid',
          body: { name: 'Bad Role', email: 'bad-role@example.com', workspaceRoleId: 'not-a-uuid' },
          expectedFields: ['workspaceRoleId'],
        },
        {
          case: 'workspaceRoleId is null',
          body: { name: 'Null Role', email: 'null-role@example.com', workspaceRoleId: null },
          expectedFields: ['workspaceRoleId'],
        },
        {
          case: 'a credential field is supplied',
          body: {
            name: 'With Password',
            email: 'with-password@example.com',
            workspaceRoleId: '__ROLE__',
            password: 'client-supplied',
          },
          expectedFields: ['password'],
        },
        {
          case: 'the request body is undefined',
          body: undefined,
          expectedFields: ['name', 'email', 'workspaceRoleId'],
        },
        {
          case: 'the request body is not an object',
          body: [],
          expectedFields: ['name', 'email', 'workspaceRoleId'],
        },
      ])('returns a validation error when $case', async ({ body, expectedFields }) => {
        const resolvedBody = resolveRolePlaceholder(body, developerActor.workspaceRole.id);

        const response = await createUserRequest(
          resolvedBody,
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectValidationError(response, expectedFields);
      });
    });

    describe('on business-rule violations', () => {
      it('returns a 422 when the workspace role does not exist', async () => {
        const email = 'unknown-role@example.com';
        const unknownRoleId = '11111111-1111-4111-8111-111111111111';

        const response = await createUserRequest(
          { name: 'Unknown Role', email, workspaceRoleId: unknownRoleId },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectBusinessRuleViolationError(response);
        expect(await fetchRawUserByEmail(email)).toBeNull();
      });

      it('returns a 422 when assigning the Workspace Owner role', async () => {
        const email = 'owner-role-assignment@example.com';

        const response = await createUserRequest(
          { name: 'Owner Assignment', email, workspaceRoleId: ownerActor.workspaceRole.id },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectBusinessRuleViolationError(response);
        expect(await fetchRawUserByEmail(email)).toBeNull();
      });
    });

    describe('on duplicate email', () => {
      it('returns a conflict error when the email already exists', async () => {
        const email = 'duplicate-create@example.com';

        const first = await createUserRequest(
          { name: 'First', email, workspaceRoleId: developerActor.workspaceRole.id },
          tokenFor(ctx.tokenService, ownerActor),
        );
        expect(first.status).toBe(201);

        const second = await createUserRequest(
          { name: 'Second', email, workspaceRoleId: developerActor.workspaceRole.id },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectConflictError(second);

        const persisted = await prisma.user.findMany({ where: { email } });
        expect(persisted).toHaveLength(1);
        expect(persisted[0]?.name).toBe('First');
      });
    });

    describe('on unexpected dependency failure', () => {
      it.each([
        {
          case: 'the workspace role repository throws',
          arrange: () =>
            jest
              .spyOn(ctx.workspaceRoleRepository, 'getWorkspaceRoleById')
              .mockRejectedValue(new Error('database unavailable')),
        },
        {
          case: 'the activation token service throws',
          arrange: () =>
            jest.spyOn(ctx.activationTokenService, 'generate').mockImplementation(() => {
              throw new Error('entropy source unavailable');
            }),
        },
        {
          case: 'the user repository throws',
          arrange: () =>
            jest
              .spyOn(ctx.userRepository, 'createUser')
              .mockRejectedValue(new Error('database unavailable')),
        },
      ])('returns an internal server error and creates no user when $case', async ({ arrange }) => {
        arrange();
        const email = 'dependency-failure@example.com';

        const response = await createUserRequest(
          { name: 'Dependency Failure', email, workspaceRoleId: developerActor.workspaceRole.id },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectInternalServerError(response);
        expect(await fetchRawUserByEmail(email)).toBeNull();
      });
    });
  });

  describe('PATCH /:id/role', () => {
    let ownerRoleId: string;
    let adminRoleId: string;
    let developerRoleId: string;

    let ownerActor: ActorContext;
    let adminActor: ActorContext;
    let developerActor: ActorContext;

    const unknownUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const unknownRoleId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    beforeAll(async () => {
      ownerRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.OWNER);
      adminRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.ADMIN);
      developerRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.DEVELOPER);

      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);

      if (!owner || !admin || !developer) {
        throw new Error('Expected users to be persisted');
      }

      ownerActor = userToActorContext(owner, []);
      adminActor = userToActorContext(admin, []);
      developerActor = userToActorContext(developer, []);
    });

    afterAll(async () => {
      await prisma.user.deleteMany();
    });

    function updateUserRoleRequest(
      targetId: string,
      body: Record<string, unknown> | undefined | unknown[],
      authorizationHeader?: string,
    ) {
      const request = supertest(app).patch(`/api/v1/users/${targetId}/role`);

      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }

      return request.send(body);
    }

    describe('on success', () => {
      it('promotes a Developer to Workspace Admin and returns the updated user', async () => {
        const target = await seedUserWithRole(
          'promote-dev-to-admin@example.com',
          'Promote Target',
          developerRoleId,
        );

        const response = await updateUserRoleRequest(
          target.id,
          { workspaceRoleId: adminRoleId },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectUpdatedUserRoleResponse(response, {
          id: target.id,
          workspaceRoleId: adminRoleId,
        });

        const persisted = await prisma.user.findUnique({ where: { id: target.id } });
        expect(persisted?.workspaceRoleId).toBe(adminRoleId);
      });

      it('demotes a Workspace Admin to Developer and returns the updated user', async () => {
        const target = await seedUserWithRole(
          'demote-admin-to-dev@example.com',
          'Demote Target',
          adminRoleId,
        );

        const response = await updateUserRoleRequest(
          target.id,
          { workspaceRoleId: developerRoleId },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectUpdatedUserRoleResponse(response, {
          id: target.id,
          workspaceRoleId: developerRoleId,
        });

        const persisted = await prisma.user.findUnique({ where: { id: target.id } });
        expect(persisted?.workspaceRoleId).toBe(developerRoleId);
      });

      it('is an idempotent no-op when the requested role equals the current role', async () => {
        const target = await seedUserWithRole(
          'noop-same-role@example.com',
          'Same Role Target',
          developerRoleId,
        );

        const response = await updateUserRoleRequest(
          target.id,
          { workspaceRoleId: developerRoleId },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectUpdatedUserRoleResponse(response, {
          id: target.id,
          workspaceRoleId: developerRoleId,
        });

        const persisted = await prisma.user.findUnique({ where: { id: target.id } });
        expect(persisted?.workspaceRoleId).toBe(developerRoleId);
      });

      it('succeeds when the target has not yet been activated', async () => {
        const target = await seedUserWithRole(
          'pending-target@example.com',
          'Pending Target',
          developerRoleId,
          { pending: true },
        );

        const response = await updateUserRoleRequest(
          target.id,
          { workspaceRoleId: adminRoleId },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectUpdatedUserRoleResponse(response, {
          id: target.id,
          workspaceRoleId: adminRoleId,
        });

        const persisted = await prisma.user.findUnique({ where: { id: target.id } });
        expect(persisted?.workspaceRoleId).toBe(adminRoleId);
        expect(persisted?.status).toBe(UserStatus.Pending);
      });
    });

    describe('on validation failure (400)', () => {
      it.each<{
        case: string;
        body: Record<string, unknown> | undefined | unknown[];
        expectedFields: string[];
      }>([
        {
          case: 'workspaceRoleId is missing',
          body: {},
          expectedFields: ['workspaceRoleId'],
        },
        {
          case: 'workspaceRoleId is null',
          body: { workspaceRoleId: null },
          expectedFields: ['workspaceRoleId'],
        },
        {
          case: 'workspaceRoleId is not a uuid',
          body: { workspaceRoleId: 'not-a-uuid' },
          expectedFields: ['workspaceRoleId'],
        },
        {
          case: 'the request body is undefined',
          body: undefined,
          expectedFields: ['workspaceRoleId'],
        },
        {
          case: 'the request body is not an object',
          body: [],
          expectedFields: ['workspaceRoleId'],
        },
        {
          case: 'the body contains an unrecognized field',
          body: { workspaceRoleId: '11111111-1111-4111-8111-111111111111', extra: 'nope' },
          expectedFields: ['extra'],
        },
      ])(
        'returns a 400 validation error when $case and does not modify any user',
        async ({ case: caseLabel, body, expectedFields }) => {
          const slug = caseLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
          const target = await seedUserWithRole(
            `validation-${slug}@example.com`,
            'Validation Target',
            developerRoleId,
          );

          const response = await updateUserRoleRequest(
            target.id,
            body,
            tokenFor(ctx.tokenService, ownerActor),
          );

          expectValidationError(response, expectedFields);

          const persisted = await prisma.user.findUnique({ where: { id: target.id } });
          expect(persisted?.workspaceRoleId).toBe(developerRoleId);
        },
      );

      it('returns a 400 validation error when the path id is not a uuid', async () => {
        const response = await updateUserRoleRequest(
          'not-a-uuid',
          { workspaceRoleId: adminRoleId },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectValidationError(response, ['id']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error and does not modify any user', async () => {
        const target = await seedUserWithRole(
          'unauthenticated-target@example.com',
          'Unauthenticated Target',
          developerRoleId,
        );

        const response = await updateUserRoleRequest(target.id, { workspaceRoleId: adminRoleId });

        expectAuthenticationRequired(response);

        const persisted = await prisma.user.findUnique({ where: { id: target.id } });
        expect(persisted?.workspaceRoleId).toBe(developerRoleId);
      });
    });

    describe('on authorization failures (403)', () => {
      it.each([
        { actorLabel: 'Admin', getActor: () => adminActor },
        { actorLabel: 'Developer', getActor: () => developerActor },
      ])(
        'returns a forbidden error when the actor is a $actorLabel and does not modify any user',
        async ({ actorLabel, getActor }) => {
          const target = await seedUserWithRole(
            `forbidden-${actorLabel.toLowerCase()}@example.com`,
            `Forbidden ${actorLabel} Target`,
            developerRoleId,
          );

          const response = await updateUserRoleRequest(
            target.id,
            { workspaceRoleId: adminRoleId },
            tokenFor(ctx.tokenService, getActor()),
          );

          expectForbiddenError(response);

          const persisted = await prisma.user.findUnique({ where: { id: target.id } });
          expect(persisted?.workspaceRoleId).toBe(developerRoleId);
        },
      );

      it('returns a forbidden error when the target currently holds the Workspace Owner role and does not modify any user', async () => {
        const target = await seedUserWithRole(
          'owner-target@example.com',
          'Owner Target',
          ownerRoleId,
        );

        const response = await updateUserRoleRequest(
          target.id,
          { workspaceRoleId: adminRoleId },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectForbiddenError(response);

        const persisted = await prisma.user.findUnique({ where: { id: target.id } });
        expect(persisted?.workspaceRoleId).toBe(ownerRoleId);
      });
    });

    describe('on target lookup failure (404)', () => {
      it('returns a resource-not-found error when the target user does not exist', async () => {
        const response = await updateUserRoleRequest(
          unknownUserId,
          { workspaceRoleId: adminRoleId },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectResourceNotFoundError(response, ctx.userRepository.resourceName);
      });
    });

    describe('on business-rule violations (422)', () => {
      it('returns a business-rule violation when the requested role does not exist and does not modify any user', async () => {
        const target = await seedUserWithRole(
          'unknown-role-target@example.com',
          'Unknown Role Target',
          developerRoleId,
        );

        const response = await updateUserRoleRequest(
          target.id,
          { workspaceRoleId: unknownRoleId },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectBusinessRuleViolationError(response);

        const persisted = await prisma.user.findUnique({ where: { id: target.id } });
        expect(persisted?.workspaceRoleId).toBe(developerRoleId);
      });

      it('returns a business-rule violation when the requested role is the Workspace Owner role and does not modify any user', async () => {
        const target = await seedUserWithRole(
          'owner-assignment-target@example.com',
          'Owner Assignment Target',
          developerRoleId,
        );

        const response = await updateUserRoleRequest(
          target.id,
          { workspaceRoleId: ownerRoleId },
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectBusinessRuleViolationError(response);

        const persisted = await prisma.user.findUnique({ where: { id: target.id } });
        expect(persisted?.workspaceRoleId).toBe(developerRoleId);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it.each<{
        case: string;
        slug: string;
        arrange: () => void;
      }>([
        {
          case: 'the user repository getUserById throws',
          slug: 'get-user-by-id',
          arrange: () => {
            jest
              .spyOn(ctx.userRepository, 'getUserById')
              .mockRejectedValue(new Error('database unavailable'));
          },
        },
        {
          case: 'the workspace role repository throws',
          slug: 'get-workspace-role',
          arrange: () => {
            jest
              .spyOn(ctx.workspaceRoleRepository, 'getWorkspaceRoleById')
              .mockRejectedValue(new Error('database unavailable'));
          },
        },
        {
          case: 'the user repository updateUserWorkspaceRoleById throws',
          slug: 'update-user-role',
          arrange: () => {
            jest
              .spyOn(ctx.userRepository, 'updateUserWorkspaceRoleById')
              .mockRejectedValue(new Error('database unavailable'));
          },
        },
      ])(
        'returns an internal server error and does not modify the target when $case',
        async ({ slug, arrange }) => {
          const target = await seedUserWithRole(
            `dependency-failure-${slug}@example.com`,
            'Dependency Failure Target',
            developerRoleId,
          );

          arrange();

          const response = await updateUserRoleRequest(
            target.id,
            { workspaceRoleId: adminRoleId },
            tokenFor(ctx.tokenService, ownerActor),
          );

          expectInternalServerError(response);

          // The spy only patches the repository method; the raw
          // `prisma.user.findUnique` below bypasses it and reads the actual
          // row. Global `afterEach` restores mocks for the next case.
          const persisted = await prisma.user.findUnique({ where: { id: target.id } });
          expect(persisted?.workspaceRoleId).toBe(developerRoleId);
        },
      );
    });
  });

  describe('GET /:id', () => {
    let developerRoleId: string;

    let ownerActor: ActorContext;
    let adminActor: ActorContext;
    let developerActor: ActorContext;

    const targetEmail = 'get-by-id-target@example.com';
    const targetName = 'Get By Id Target';
    let target: { id: string; workspaceRoleId: string };

    const unknownUserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const validUuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    beforeAll(async () => {
      developerRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.DEVELOPER);

      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);

      if (!owner || !admin || !developer) {
        throw new Error('Expected users to be persisted');
      }

      ownerActor = userToActorContext(owner, []);
      adminActor = userToActorContext(admin, []);
      developerActor = userToActorContext(developer, []);

      target = await seedUserWithRole(targetEmail, targetName, developerRoleId);
    });

    afterAll(async () => {
      await prisma.user.deleteMany();
    });

    function getUserByIdRequest(id: string, authorizationHeader?: string) {
      const request = supertest(app).get(`/api/v1/users/${id}`);

      if (authorizationHeader !== undefined) {
        request.set('Authorization', authorizationHeader);
      }

      return request;
    }

    describe('on success', () => {
      it.each([
        { actorLabel: 'Owner', getActor: () => ownerActor },
        { actorLabel: 'Admin', getActor: () => adminActor },
        { actorLabel: 'Developer', getActor: () => developerActor },
      ])(
        'returns 200 with the target user resource for a $actorLabel actor',
        async ({ getActor }) => {
          const response = await getUserByIdRequest(
            target.id,
            tokenFor(ctx.tokenService, getActor()),
          );

          expectUserDetailsResponse(response, {
            id: target.id,
            name: targetName,
            email: targetEmail,
            workspaceRoleId: target.workspaceRoleId,
          });
        },
      );

      it('exposes only safe fields and no credential or activation material', async () => {
        const response = await getUserByIdRequest(
          target.id,
          tokenFor(ctx.tokenService, ownerActor),
        );

        expect(response.status).toBe(200);
        const user = response.body.data as Record<string, unknown>;

        expect(Object.keys(user).sort()).toEqual(
          ['id', 'name', 'email', 'workspaceRoleId', 'status', 'createdAt', 'updatedAt'].sort(),
        );
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('activationTokenHash');
        expect(user).not.toHaveProperty('activationTokenExpiresAt');
      });
    });

    describe('on validation failure (400)', () => {
      it('returns a 400 validation error when the path id is not a uuid', async () => {
        const response = await getUserByIdRequest(
          'not-a-uuid',
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectValidationError(response, ['id']);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error when no token is provided', async () => {
        const response = await getUserByIdRequest(validUuid);

        expectAuthenticationRequired(response);
      });
    });

    describe('on authorization failures (403)', () => {
      it("returns a forbidden error when the actor's workspace role is not in the getUserById matrix and does not query the repository for the target", async () => {
        const unsupportedWorkspaceRoleName = 'Viewer' as WorkspaceRoleName;

        jest.spyOn(ctx.workspaceRoleRepository, 'getWorkspaceRoleById').mockResolvedValue({
          id: ownerActor.workspaceRole.id,
          name: unsupportedWorkspaceRoleName,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await getUserByIdRequest(
          target.id,
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectForbiddenError(response);
      });
    });

    describe('on target lookup failure (404)', () => {
      it('returns a resource-not-found error when the target user does not exist', async () => {
        const response = await getUserByIdRequest(
          unknownUserId,
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectResourceNotFoundError(response, ctx.userRepository.resourceName);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when the user repository getUserById throws for the target lookup', async () => {
        jest
          .spyOn(ctx.userRepository, 'getUserById')
          .mockRejectedValue(new Error('database unavailable'));

        const response = await getUserByIdRequest(
          target.id,
          tokenFor(ctx.tokenService, ownerActor),
        );

        expectInternalServerError(response);
      });
    });
  });
});
