import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import supertest from 'supertest';

import { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { ProjectRoleName } from '@/modules/project-members';
import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { prisma } from '@/common/lib/prisma';
import { UserStatus } from '@/generated/prisma/enums';

import { createTestUsers } from '../../fixtures/users.fixtures';
import { ensureWorkspaceRolesSeeded } from '../../fixtures/workspace-roles.fixtures';
import {
  addUserToNewProject,
  ensureProjectRolesSeeded,
  SeededProjectMembership,
} from '../../fixtures/project-members.fixtures';

import {
  expectAuthenticationRequired,
  expectBusinessRuleViolationError,
  expectConflictError,
  expectForbiddenError,
  expectInternalServerError,
  expectValidationError,
} from '../../assertions/errors.assertions';
import {
  expectDataIds,
  expectDataIdsInOrder,
  expectEmptyPaginatedEnvelope,
  expectPaginatedEnvelope,
} from '../../assertions/list.assertions';

import {
  createExpiredToken,
  createTokenWithWrongSecret,
  createUsersTestContext,
  fetchPersistedUser,
  fetchRawUserByEmail,
  fetchWorkspaceRoleIdByName,
  PersistedUser,
  testUsers,
  UsersTestContext,
} from './users.controller.fixtures';
import {
  expectActorContextResponse,
  expectCreatedUserResponse,
  expectPendingUserPersisted,
  extractActivationToken,
} from './users.controller.assertions';
import { TestUser } from '../workspace/workspace.controller.fixtures';
import { User } from '@/generated/prisma/client';

function fetchPersistedUsers(testUsers: TestUser[]): Promise<PersistedUser[]> {
  return Promise.all(
    testUsers.map(async (testUser) => {
      const user = await fetchPersistedUser(testUser.email);

      if (!user) {
        throw new Error(`Expected user ${testUser.email} to be persisted`);
      }

      return user;
    }),
  );
}

function parsePersistedUserIntoActorContext(
  user: PersistedUser | undefined,
  projectRoles: SeededProjectMembership[],
): ActorContext {
  if (!user) {
    throw new Error('User is undefined');
  }

  return {
    userId: user.id,
    workspaceRole: { id: user.workspaceRoleId, name: user.workspaceRoleName },
    projectRoles: projectRoles.map((projectRole) => ({
      projectId: projectRole.projectId,
      projectRoleId: projectRole.projectRoleId,
      projectRoleName: projectRole.projectRoleName,
    })),
  };
}

describe('Users Controller', () => {
  let app: Application;
  let ctx: UsersTestContext;

  let ownerActor: ActorContext;
  let adminActor: ActorContext;
  let developerActor: ActorContext;

  beforeAll(async () => {
    ctx = createUsersTestContext();
    app = ctx.app;

    await ensureWorkspaceRolesSeeded();
    await ensureProjectRolesSeeded();
  });

  function bearer(token: string): string {
    return `Bearer ${token}`;
  }

  function tokenFor(actor: ActorContext): string {
    return bearer(
      ctx.tokenService.generateToken({
        userId: actor.userId,
        workspaceRoleId: actor.workspaceRole.id,
      }),
    );
  }

  describe('GET /me', () => {
    beforeAll(async () => {
      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);

      const membership: SeededProjectMembership = await addUserToNewProject(
        owner?.id ?? '',
        ProjectRoleName.PROJECT_OWNER,
        'Users controller test project',
      );

      ownerActor = parsePersistedUserIntoActorContext(owner, [membership]);
      adminActor = parsePersistedUserIntoActorContext(admin, []);
      developerActor = parsePersistedUserIntoActorContext(developer, []);
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
      it('returns the actor context for an Owner user', async () => {
        const response = await getMe(tokenFor(ownerActor));

        expectActorContextResponse(response, ownerActor);
      });

      it('returns the actor context for an Admin user', async () => {
        const response = await getMe(tokenFor(adminActor));

        expectActorContextResponse(response, adminActor);
      });

      it('returns the actor context for a Developer user', async () => {
        const response = await getMe(tokenFor(developerActor));

        expectActorContextResponse(response, developerActor);
      });

      it('returns the project roles for a user that is a member of a project', async () => {
        const response = await getMe(tokenFor(ownerActor));

        expect(response.status).toBe(200);
        expect(response.body.data.projectRoles).toEqual(ownerActor.projectRoles);
        expect(response.body.data.projectRoles).toHaveLength(1);
      });

      it('returns an empty project roles array for a user with no memberships', async () => {
        const response = await getMe(tokenFor(adminActor));

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

        const response = await getMe(tokenFor(ownerActor));

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

        const response = await getMe(tokenFor(ownerActor));

        expectInternalServerError(response);
      });
    });
  });

  describe('GET /', () => {
    const usersCount = 25;

    const pageSize = 10;
    const expectedTotal = usersCount;
    const expectedTotalPages = Math.ceil(expectedTotal / pageSize);

    const ownerUsersCount = 10;
    const adminUsersCount = 10;
    const developerUsersCount = 5;

    const oldDate = new Date('2020-01-01T00:00:00Z');
    const recentDate = new Date('2020-06-01T00:00:00Z');

    let allUsers: User[] = [];
    let ownerUsers: User[] = [];
    let adminUsers: User[] = [];
    let developerUsers: User[] = [];

    beforeAll(async () => {
      ownerUsers = await prisma.user.createManyAndReturn({
        data: await Promise.all(
          Array.from({ length: ownerUsersCount }, async (_, i) => {
            const workspaceRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.OWNER);

            return {
              email: `owner-user-${i}@example.com`,
              name: `Owner User ${i}`,
              workspaceRoleId: workspaceRoleId ?? '',
              status: i < 5 ? UserStatus.Active : UserStatus.Pending,
              password: null as string | null,
              createdAt: i % 2 === 0 ? oldDate : recentDate,
            };
          }),
        ),
      });
      adminUsers = await prisma.user.createManyAndReturn({
        data: await Promise.all(
          Array.from({ length: adminUsersCount }, async (_, i) => {
            const workspaceRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.ADMIN);

            return {
              email: `admin-user-${i}@example.com`,
              name: `Admin User ${i}`,
              workspaceRoleId: workspaceRoleId ?? '',
              status: i < 5 ? UserStatus.Active : UserStatus.Pending,
              password: null as string | null,
              createdAt: i % 2 === 0 ? oldDate : recentDate,
            };
          }),
        ),
      });
      developerUsers = await prisma.user.createManyAndReturn({
        data: await Promise.all(
          Array.from({ length: developerUsersCount }, async (_, i) => {
            const workspaceRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.DEVELOPER);

            return {
              email: `developer-user-${i}@example.com`,
              name: `Developer User ${i}`,
              workspaceRoleId: workspaceRoleId ?? '',
              status: UserStatus.Active,
              password: null as string | null,
              createdAt: recentDate,
            };
          }),
        ),
      });

      allUsers = [...ownerUsers, ...adminUsers, ...developerUsers];

      const activeOwnerUser = ownerUsers.find((user) => user.status === UserStatus.Active);
      const activeAdminUser = adminUsers.find((user) => user.status === UserStatus.Active);
      const activeDeveloperUser = developerUsers.find((user) => user.status === UserStatus.Active);

      if (!activeOwnerUser || !activeAdminUser || !activeDeveloperUser) {
        throw new Error(
          'Expected an active user to be seeded for each of Owner, Admin, and Developer',
        );
      }

      ownerActor = parsePersistedUserIntoActorContext(
        {
          id: activeOwnerUser.id,
          workspaceRoleId: activeOwnerUser.workspaceRoleId,
          workspaceRoleName: WorkspaceRoleName.OWNER,
        },
        [],
      );
      adminActor = parsePersistedUserIntoActorContext(
        {
          id: activeAdminUser.id,
          workspaceRoleId: activeAdminUser.workspaceRoleId,
          workspaceRoleName: WorkspaceRoleName.ADMIN,
        },
        [],
      );
      developerActor = parsePersistedUserIntoActorContext(
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

    function listUsers(query?: Record<string, unknown>, authorizationHeader?: string) {
      let request = supertest(app).get('/api/v1/users');

      if (authorizationHeader !== undefined) {
        request = request.set('Authorization', authorizationHeader);
      }

      if (query) {
        request = request.query(query);
      }

      return request;
    }

    describe('on success', () => {
      describe('envelope and pagination over a known population', () => {
        it('returns the first page with correct data length and pagination totals', async () => {
          const response = await listUsers(
            { page: '1', pageSize: String(pageSize) },
            tokenFor(ownerActor),
          );

          expectPaginatedEnvelope(response, {
            page: 1,
            pageSize: pageSize,
            totalItems: expectedTotal,
            totalPages: expectedTotalPages,
            dataLength: pageSize,
          });
        });

        it('applies skip/take so the final page returns only the remaining users', async () => {
          const remainder = expectedTotal - (expectedTotalPages - 1) * pageSize;

          const response = await listUsers(
            { page: String(expectedTotalPages), pageSize: String(pageSize) },
            tokenFor(ownerActor),
          );

          expectPaginatedEnvelope(response, {
            page: expectedTotalPages,
            pageSize: pageSize,
            totalItems: expectedTotal,
            totalPages: expectedTotalPages,
            dataLength: remainder,
          });
        });
      });

      it('returns an empty envelope with zeroed totals when no users match the filter', async () => {
        const response = await listUsers(
          { 'filter[workspaceRoleId]': '11111111-1111-4111-8111-111111111111' },
          tokenFor(ownerActor),
        );

        expectEmptyPaginatedEnvelope(response);
      });
    });

    describe('on authorized roles', () => {
      it.each([
        { case: 'Owner', getActor: () => ownerActor },
        { case: 'Admin', getActor: () => adminActor },
        { case: 'Developer', getActor: () => developerActor },
      ])('returns 200 with a valid envelope for a $case actor', async ({ getActor }) => {
        const response = await listUsers(undefined, tokenFor(getActor()));

        expectPaginatedEnvelope(response);
      });
    });

    describe('on filtering', () => {
      // A controlled population that lets each filter assert BOTH inclusion
      // (matching rows returned) and exclusion (non-matching rows absent). The
      // generic parse/coerce rules are covered by the query-parser unit tests;
      // here we prove the users query-config filters real rows against the real
      // column and enum types end to end.
      let pendingUserIds: string[] = [];
      let recentUserIds: string[] = [];

      let adminWorkspaceRoleId: string;
      let developerWorkspaceRoleId: string;

      const RANGE_LOWER = new Date('2020-03-01T00:00:00Z');
      const RANGE_UPPER = new Date('2020-12-31T00:00:00Z');

      beforeAll(async () => {
        pendingUserIds = allUsers
          .filter((user) => user.status === UserStatus.Pending)
          .map((user) => user.id);
        recentUserIds = allUsers
          .filter((user) => user.createdAt >= RANGE_LOWER && user.createdAt <= RANGE_UPPER)
          .map((user) => user.id);

        adminWorkspaceRoleId = adminUsers[0]?.workspaceRoleId ?? '';
        developerWorkspaceRoleId = developerUsers[0]?.workspaceRoleId ?? '';
      });

      it('returns exactly the Pending users for filter[status]=Pending (enum coercion)', async () => {
        const response = await listUsers({ 'filter[status]': 'Pending' }, tokenFor(ownerActor));

        expectDataIds(response, pendingUserIds);
        expect(response.body.meta.pagination.totalItems).toBe(pendingUserIds.length);
      });

      it('returns exactly the users matching filter[workspaceRoleId] (uuid coercion) for a given workspace role', async () => {
        const response = await listUsers(
          { 'filter[workspaceRoleId]': adminWorkspaceRoleId, pageSize: '100' },
          tokenFor(ownerActor),
        );

        expectDataIds(
          response,
          adminUsers.map((user) => user.id),
        );
      });

      it('returns exactly the users whose role is in filter[workspaceRoleId][in]', async () => {
        const response = await listUsers(
          {
            'filter[workspaceRoleId][in]': `${adminWorkspaceRoleId},${developerWorkspaceRoleId}`,
            pageSize: '100',
          },
          tokenFor(ownerActor),
        );

        expectDataIds(response, [
          ...adminUsers.map((user) => user.id),
          ...developerUsers.map((user) => user.id),
        ]);
      });

      it('excludes rows outside a createdAt window (date coercion, gte + lte)', async () => {
        const response = await listUsers(
          {
            'filter[createdAt][gte]': RANGE_LOWER.toISOString(),
            'filter[createdAt][lte]': RANGE_UPPER.toISOString(),
            pageSize: '100',
          },
          tokenFor(ownerActor),
        );

        expectDataIds(response, recentUserIds);
      });
    });

    describe('on sorting', () => {
      const allUsersCopy: User[] = allUsers.slice();

      describe('with users at distinct timestamps', () => {
        let orderedNewestFirst: string[] = [];

        beforeAll(async () => {
          let createdAt = new Date('2021-01-01T00:00:00Z');

          for (const user of allUsers) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                createdAt: createdAt,
              },
            });

            createdAt = new Date(createdAt.getTime() + 60 * 60 * 24 * 1000); // 1 day apart
          }

          allUsers = await prisma.user.findMany();
          orderedNewestFirst = allUsers
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((user) => user.id);
        });

        afterAll(async () => {
          await Promise.all(
            allUsers.map(async (user) => {
              const originalCreatedAt = allUsersCopy.find((u) => u.id === user.id)?.createdAt;

              await prisma.user.update({
                where: { id: user.id },
                data: {
                  createdAt: originalCreatedAt,
                },
              });
            }),
          );

          allUsers = await prisma.user.findMany();
        });

        it('orders rows by createdAt descending for sort=-createdAt', async () => {
          const response = await listUsers(
            { sort: '-createdAt', pageSize: '100' },
            tokenFor(ownerActor),
          );

          expectDataIdsInOrder(response, orderedNewestFirst);
        });
      });

      describe('with users sharing a timestamp', () => {
        let tiedIdsAscending: string[] = [];

        beforeAll(async () => {
          const sharedCreatedAt = new Date('2021-05-01T00:00:00Z');

          await Promise.all(
            allUsers.map((user) =>
              prisma.user.update({
                where: { id: user.id },
                data: {
                  createdAt: sharedCreatedAt,
                },
              }),
            ),
          );

          allUsers = await prisma.user.findMany();
          tiedIdsAscending = allUsers
            .sort((a, b) => a.id.localeCompare(b.id))
            .map((user) => user.id);
        });

        afterAll(async () => {
          await Promise.all(
            allUsers.map(async (user) => {
              const originalCreatedAt = allUsers.find((u) => u.id === user.id)?.createdAt;

              await prisma.user.update({
                where: { id: user.id },
                data: {
                  createdAt: originalCreatedAt,
                },
              });
            }),
          );

          allUsers = await prisma.user.findMany();
        });

        it('breaks createdAt ties with a stable id ascending order', async () => {
          const response = await listUsers(
            { sort: '-createdAt', pageSize: '100' },
            tokenFor(ownerActor),
          );

          expectDataIdsInOrder(response, tiedIdsAscending);
        });
      });
    });

    describe('on pagination defaults', () => {
      it('applies the users query-config defaults (page=1, pageSize=10) when neither is supplied', async () => {
        const response = await listUsers(undefined, tokenFor(ownerActor));

        expectPaginatedEnvelope(response, { page: 1, pageSize: 10 });
      });
    });

    describe('on safe fields', () => {
      it('every user in data exposes only safe fields and no credential material', async () => {
        const response = await listUsers(undefined, tokenFor(ownerActor));

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

    describe('on authorization failures', () => {
      it('returns 403 for an actor whose workspace role is not in the listUsers matrix', async () => {
        jest.spyOn(ctx.workspaceRoleRepository, 'getWorkspaceRoleById').mockResolvedValue({
          id: ownerActor.workspaceRole.id,
          name: 'Viewer' as WorkspaceRoleName,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await listUsers(undefined, tokenFor(ownerActor));

        expectForbiddenError(response);
      });

      it('returns 401 for an unauthenticated request', async () => {
        const response = await listUsers();

        expectAuthenticationRequired(response);
      });
    });

    describe('on query-validation failures', () => {
      // The exhaustive validation matrix (bad sort field, unknown filter,
      // disallowed operator, oversized pageSize, non-UUID value, ...) lives in
      // the query-parser unit tests. Here we only prove the parser is wired to
      // the users query-config and that its ValidationError surfaces as a 400
      // through the error middleware.
      it('returns 400 naming the offending field when the query fails validation', async () => {
        const response = await listUsers({ sort: 'disallowed' }, tokenFor(ownerActor));

        expectValidationError(response, ['sort']);
      });
    });

    describe('on unexpected dependency failure', () => {
      it('returns 500 when the user repository throws', async () => {
        jest
          .spyOn(ctx.userRepository, 'findUsers')
          .mockRejectedValue(new Error('database unavailable'));

        const response = await listUsers(undefined, tokenFor(ownerActor));

        expectInternalServerError(response);
      });
    });
  });

  describe('POST /', () => {
    beforeAll(async () => {
      await createTestUsers(testUsers);
      const [owner, admin, developer] = await fetchPersistedUsers(testUsers);

      ownerActor = parsePersistedUserIntoActorContext(owner, []);
      adminActor = parsePersistedUserIntoActorContext(admin, []);
      developerActor = parsePersistedUserIntoActorContext(developer, []);
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
            tokenFor(getActor()),
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
          tokenFor(developerActor),
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

        const response = await createUserRequest(resolvedBody, tokenFor(ownerActor));

        expectValidationError(response, expectedFields);
      });
    });

    describe('on business-rule violations', () => {
      it('returns a 422 when the workspace role does not exist', async () => {
        const email = 'unknown-role@example.com';
        const unknownRoleId = '11111111-1111-4111-8111-111111111111';

        const response = await createUserRequest(
          { name: 'Unknown Role', email, workspaceRoleId: unknownRoleId },
          tokenFor(ownerActor),
        );

        expectBusinessRuleViolationError(response);
        expect(await fetchRawUserByEmail(email)).toBeNull();
      });

      it('returns a 422 when assigning the Workspace Owner role', async () => {
        const email = 'owner-role-assignment@example.com';

        const response = await createUserRequest(
          { name: 'Owner Assignment', email, workspaceRoleId: ownerActor.workspaceRole.id },
          tokenFor(ownerActor),
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
          tokenFor(ownerActor),
        );
        expect(first.status).toBe(201);

        const second = await createUserRequest(
          { name: 'Second', email, workspaceRoleId: developerActor.workspaceRole.id },
          tokenFor(ownerActor),
        );

        expectConflictError(second);
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
          tokenFor(ownerActor),
        );

        expectInternalServerError(response);
        expect(await fetchRawUserByEmail(email)).toBeNull();
      });
    });
  });
});
