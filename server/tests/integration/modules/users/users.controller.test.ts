import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
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
  deleteNonSeededUsers,
  fetchPersistedUser,
  fetchRawUserByEmail,
  fetchWorkspaceRoleIdByName,
  testUsers,
  UsersTestContext,
} from './users.controller.fixtures';
import {
  expectActorContextResponse,
  expectCreatedUserResponse,
  expectPendingUserPersisted,
  extractActivationToken,
} from './users.controller.assertions';

describe('Users Controller', () => {
  let app: Application;
  let ctx: UsersTestContext;

  let ownerActor: ActorContext;
  let adminActor: ActorContext;
  let developerActor: ActorContext;

  let ownerUserId: string;
  let ownerWorkspaceRoleId: string;

  beforeAll(async () => {
    ctx = createUsersTestContext();
    app = ctx.app;

    await ensureWorkspaceRolesSeeded();
    await ensureProjectRolesSeeded();
    await createTestUsers(testUsers);

    const [ownerUser, adminUser, developerUser] = testUsers;
    if (!ownerUser || !adminUser || !developerUser) {
      throw new Error('Expected three seeded users, one per workspace role');
    }

    const owner = await fetchPersistedUser(ownerUser.email);
    const admin = await fetchPersistedUser(adminUser.email);
    const developer = await fetchPersistedUser(developerUser.email);

    ownerUserId = owner.id;
    ownerWorkspaceRoleId = owner.workspaceRoleId;

    const membership: SeededProjectMembership = await addUserToNewProject(
      owner.id,
      ProjectRoleName.PROJECT_OWNER,
      'Users controller test project',
    );

    ownerActor = {
      userId: owner.id,
      workspaceRole: { id: owner.workspaceRoleId, name: ownerUser.workspaceRoleName },
      projectRoles: [
        {
          projectId: membership.projectId,
          projectRoleId: membership.projectRoleId,
          projectRoleName: membership.projectRoleName,
        },
      ],
    };

    adminActor = {
      userId: admin.id,
      workspaceRole: { id: admin.workspaceRoleId, name: adminUser.workspaceRoleName },
      projectRoles: [],
    };

    developerActor = {
      userId: developer.id,
      workspaceRole: { id: developer.workspaceRoleId, name: developerUser.workspaceRoleName },
      projectRoles: [],
    };
  });

  function getMe(authorizationHeader?: string) {
    const request = supertest(app).get('/api/v1/users/me');
    if (authorizationHeader === undefined) {
      return request;
    }
    return request.set('Authorization', authorizationHeader);
  }

  function bearer(token: string): string {
    return `Bearer ${token}`;
  }

  function ownerBearerToken(): string {
    return bearer(
      ctx.tokenService.generateToken({
        userId: ownerActor.userId,
        workspaceRoleId: ownerActor.workspaceRole.id,
      }),
    );
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
    describe('on success', () => {
      it('returns the actor context for an Owner user', async () => {
        const token = ctx.tokenService.generateToken({
          userId: ownerActor.userId,
          workspaceRoleId: ownerActor.workspaceRole.id,
        });

        const response = await getMe(bearer(token));

        expectActorContextResponse(response, ownerActor);
      });

      it('returns the actor context for an Admin user', async () => {
        const token = ctx.tokenService.generateToken({
          userId: adminActor.userId,
          workspaceRoleId: adminActor.workspaceRole.id,
        });

        const response = await getMe(bearer(token));

        expectActorContextResponse(response, adminActor);
      });

      it('returns the actor context for a Developer user', async () => {
        const token = ctx.tokenService.generateToken({
          userId: developerActor.userId,
          workspaceRoleId: developerActor.workspaceRole.id,
        });

        const response = await getMe(bearer(token));

        expectActorContextResponse(response, developerActor);
      });

      it('returns the project roles for a user that is a member of a project', async () => {
        const token = ctx.tokenService.generateToken({
          userId: ownerActor.userId,
          workspaceRoleId: ownerActor.workspaceRole.id,
        });

        const response = await getMe(bearer(token));

        expect(response.status).toBe(200);
        expect(response.body.data.projectRoles).toEqual(ownerActor.projectRoles);
        expect(response.body.data.projectRoles).toHaveLength(1);
      });

      it('returns an empty project roles array for a user with no memberships', async () => {
        const token = ctx.tokenService.generateToken({
          userId: adminActor.userId,
          workspaceRoleId: adminActor.workspaceRole.id,
        });

        const response = await getMe(bearer(token));

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
        const invalidToken = createTokenWithWrongSecret(ownerUserId, ownerWorkspaceRoleId);

        const response = await getMe(bearer(invalidToken));

        expectAuthenticationRequired(response);
      });

      it('returns an authentication required error when the token is expired', async () => {
        const expiredToken = createExpiredToken(ownerUserId, ownerWorkspaceRoleId);

        const response = await getMe(bearer(expiredToken));

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

        const response = await getMe(ownerBearerToken());

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

        const response = await getMe(ownerBearerToken());

        expectInternalServerError(response);
      });
    });
  });

  describe('GET /', () => {
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
        const EXTRA_USER_COUNT = 22;
        const PAGE_SIZE = 10;
        const expectedTotal = testUsers.length + EXTRA_USER_COUNT;
        const expectedTotalPages = Math.ceil(expectedTotal / PAGE_SIZE);

        let extraUserIds: string[] = [];

        beforeAll(async () => {
          const ownerRoleId = ownerActor.workspaceRole.id;
          const extras = Array.from({ length: EXTRA_USER_COUNT }, (_, i) => ({
            email: `pagination-user-${i + 1}@example.com`,
            name: `Pagination User ${i + 1}`,
            workspaceRoleId: ownerRoleId,
            status: UserStatus.Active,
            password: null as string | null,
          }));
          const created = await prisma.user.createManyAndReturn({ data: extras });
          extraUserIds = created.map((u) => u.id);
        });

        afterAll(async () => {
          if (extraUserIds.length) {
            await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
          }
        });

        it('returns the first page with correct data length and pagination totals', async () => {
          const response = await listUsers(
            { page: '1', pageSize: String(PAGE_SIZE) },
            tokenFor(ownerActor),
          );

          expectPaginatedEnvelope(response, {
            page: 1,
            pageSize: PAGE_SIZE,
            totalItems: expectedTotal,
            totalPages: expectedTotalPages,
            dataLength: PAGE_SIZE,
          });
        });

        it('applies skip/take so the final page returns only the remaining users', async () => {
          const remainder = expectedTotal - (expectedTotalPages - 1) * PAGE_SIZE;

          const response = await listUsers(
            { page: String(expectedTotalPages), pageSize: String(PAGE_SIZE) },
            tokenFor(ownerActor),
          );

          expectPaginatedEnvelope(response, {
            page: expectedTotalPages,
            pageSize: PAGE_SIZE,
            totalItems: expectedTotal,
            totalPages: expectedTotalPages,
            dataLength: remainder,
          });
        });
      });

      it('returns an empty envelope with zeroed totals when no users match the filter', async () => {
        const response = await listUsers({ 'filter[status]': 'Pending' }, tokenFor(ownerActor));

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
      let oldUserId: string;
      let recentUserId: string;

      const RANGE_LOWER = new Date('2020-03-01T00:00:00Z');
      const RANGE_UPPER = new Date('2020-12-31T00:00:00Z');

      beforeAll(async () => {
        const ownerRoleId = ownerActor.workspaceRole.id;

        const pending = await prisma.user.createManyAndReturn({
          data: [
            {
              email: 'filter-pending-a@example.com',
              name: 'Filter Pending A',
              workspaceRoleId: ownerRoleId,
              status: UserStatus.Pending,
              password: null,
              activationTokenHash: 'hash-a',
              activationTokenExpiresAt: new Date('2026-12-31'),
            },
            {
              email: 'filter-pending-b@example.com',
              name: 'Filter Pending B',
              workspaceRoleId: ownerRoleId,
              status: UserStatus.Pending,
              password: null,
              activationTokenHash: 'hash-b',
              activationTokenExpiresAt: new Date('2026-12-31'),
            },
          ],
        });
        pendingUserIds = pending.map((u) => u.id);

        const dated = await prisma.user.createManyAndReturn({
          data: [
            {
              email: 'filter-old@example.com',
              name: 'Filter Old',
              workspaceRoleId: ownerRoleId,
              status: UserStatus.Active,
              password: null,
              createdAt: new Date('2020-01-01T00:00:00Z'),
            },
            {
              email: 'filter-recent@example.com',
              name: 'Filter Recent',
              workspaceRoleId: ownerRoleId,
              status: UserStatus.Active,
              password: null,
              createdAt: new Date('2020-06-01T00:00:00Z'),
            },
          ],
        });

        const [oldUser, recentUser] = dated;

        if (!oldUser || !recentUser) {
          throw new Error('Expected two dated users to be seeded');
        }

        oldUserId = oldUser.id;
        recentUserId = recentUser.id;
      });

      afterAll(async () => {
        const ids = [...pendingUserIds, oldUserId, recentUserId];
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      });

      it('returns exactly the Pending users for filter[status]=Pending (enum coercion)', async () => {
        const response = await listUsers({ 'filter[status]': 'Pending' }, tokenFor(ownerActor));

        expectDataIds(response, pendingUserIds);
        expect(response.body.meta.pagination.totalItems).toBe(pendingUserIds.length);
      });

      it('returns exactly the single user matching filter[workspaceRoleId] (uuid coercion)', async () => {
        const response = await listUsers(
          { 'filter[workspaceRoleId]': adminActor.workspaceRole.id },
          tokenFor(ownerActor),
        );

        expectDataIds(response, [adminActor.userId]);
      });

      it('returns exactly the users whose role is in filter[workspaceRoleId][in]', async () => {
        const response = await listUsers(
          {
            'filter[workspaceRoleId][in]': `${adminActor.workspaceRole.id},${developerActor.workspaceRole.id}`,
          },
          tokenFor(ownerActor),
        );

        expectDataIds(response, [adminActor.userId, developerActor.userId]);
      });

      it('excludes rows outside a createdAt window (date coercion, gte + lte)', async () => {
        const response = await listUsers(
          {
            'filter[createdAt][gte]': RANGE_LOWER.toISOString(),
            'filter[createdAt][lte]': RANGE_UPPER.toISOString(),
          },
          tokenFor(ownerActor),
        );

        // Only the recent dated user falls inside the window: the old user sits
        // below the lower bound and every "now"-stamped actor sits above the
        // upper bound, so all of them are excluded.
        expectDataIds(response, [recentUserId]);
      });
    });

    describe('on sorting', () => {
      // Sort tests isolate a controlled Pending set via filter[status]=Pending so
      // the assertion can pin an exact order independent of the seeded actors.
      describe('with users at distinct timestamps', () => {
        let orderedNewestFirst: string[] = [];

        beforeAll(async () => {
          const ownerRoleId = ownerActor.workspaceRole.id;
          const created = await prisma.user.createManyAndReturn({
            data: [
              {
                email: 'sort-1@example.com',
                name: 'Sort 1',
                workspaceRoleId: ownerRoleId,
                status: UserStatus.Pending,
                password: null,
                activationTokenHash: 'sort-hash-1',
                activationTokenExpiresAt: new Date('2026-12-31'),
                createdAt: new Date('2021-01-01T00:00:00Z'),
              },
              {
                email: 'sort-2@example.com',
                name: 'Sort 2',
                workspaceRoleId: ownerRoleId,
                status: UserStatus.Pending,
                password: null,
                activationTokenHash: 'sort-hash-2',
                activationTokenExpiresAt: new Date('2026-12-31'),
                createdAt: new Date('2021-02-01T00:00:00Z'),
              },
              {
                email: 'sort-3@example.com',
                name: 'Sort 3',
                workspaceRoleId: ownerRoleId,
                status: UserStatus.Pending,
                password: null,
                activationTokenHash: 'sort-hash-3',
                activationTokenExpiresAt: new Date('2026-12-31'),
                createdAt: new Date('2021-03-01T00:00:00Z'),
              },
            ],
          });
          const idByEmail = new Map(created.map((u) => [u.email, u.id]));
          orderedNewestFirst = [
            idByEmail.get('sort-3@example.com') as string,
            idByEmail.get('sort-2@example.com') as string,
            idByEmail.get('sort-1@example.com') as string,
          ];
        });

        afterAll(async () => {
          await prisma.user.deleteMany({
            where: {
              email: { in: ['sort-1@example.com', 'sort-2@example.com', 'sort-3@example.com'] },
            },
          });
        });

        it('orders rows by createdAt descending for sort=-createdAt', async () => {
          const response = await listUsers(
            { 'filter[status]': 'Pending', sort: '-createdAt' },
            tokenFor(ownerActor),
          );

          expectDataIdsInOrder(response, orderedNewestFirst);
        });
      });

      describe('with users sharing a timestamp', () => {
        let tiedIdsAscending: string[] = [];

        beforeAll(async () => {
          const ownerRoleId = ownerActor.workspaceRole.id;
          const sharedCreatedAt = new Date('2021-05-01T00:00:00Z');
          const created = await prisma.user.createManyAndReturn({
            data: [
              {
                email: 'tie-a@example.com',
                name: 'Tie A',
                workspaceRoleId: ownerRoleId,
                status: UserStatus.Pending,
                password: null,
                activationTokenHash: 'tie-hash-a',
                activationTokenExpiresAt: new Date('2026-12-31'),
                createdAt: sharedCreatedAt,
              },
              {
                email: 'tie-b@example.com',
                name: 'Tie B',
                workspaceRoleId: ownerRoleId,
                status: UserStatus.Pending,
                password: null,
                activationTokenHash: 'tie-hash-b',
                activationTokenExpiresAt: new Date('2026-12-31'),
                createdAt: sharedCreatedAt,
              },
            ],
          });

          // Derive the expected order from the DB using the same secondary key
          // the repository applies (id asc), so the oracle matches Postgres uuid
          // ordering exactly rather than relying on JS string-sort equivalence.
          const ordered = await prisma.user.findMany({
            where: { id: { in: created.map((u) => u.id) } },
            orderBy: { id: 'asc' },
            select: { id: true },
          });
          tiedIdsAscending = ordered.map((u) => u.id);
        });

        afterAll(async () => {
          await prisma.user.deleteMany({
            where: { email: { in: ['tie-a@example.com', 'tie-b@example.com'] } },
          });
        });

        it('breaks createdAt ties with a stable id ascending order', async () => {
          const response = await listUsers(
            { 'filter[status]': 'Pending', sort: '-createdAt' },
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
    let developerRoleId: string;
    let adminRoleId: string;

    beforeAll(async () => {
      developerRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.DEVELOPER);
      adminRoleId = await fetchWorkspaceRoleIdByName(WorkspaceRoleName.ADMIN);
    });

    afterEach(deleteNonSeededUsers);

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
          getRoleId: () => developerRoleId,
          email: 'created-by-owner-developer@example.com',
        },
        {
          actorLabel: 'Workspace Owner',
          getActor: () => ownerActor,
          roleLabel: 'Admin',
          getRoleId: () => adminRoleId,
          email: 'created-by-owner-admin@example.com',
        },
        {
          actorLabel: 'Workspace Admin',
          getActor: () => adminActor,
          roleLabel: 'Developer',
          getRoleId: () => developerRoleId,
          email: 'created-by-admin-developer@example.com',
        },
        {
          actorLabel: 'Workspace Admin',
          getActor: () => adminActor,
          roleLabel: 'Admin',
          getRoleId: () => adminRoleId,
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
          { name: 'Should Not Exist', email, workspaceRoleId: developerRoleId },
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
          workspaceRoleId: developerRoleId,
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
        const resolvedBody = resolveRolePlaceholder(body, developerRoleId);

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
          { name: 'Owner Assignment', email, workspaceRoleId: ownerWorkspaceRoleId },
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
          { name: 'First', email, workspaceRoleId: developerRoleId },
          tokenFor(ownerActor),
        );
        expect(first.status).toBe(201);

        const second = await createUserRequest(
          { name: 'Second', email, workspaceRoleId: developerRoleId },
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
          { name: 'Dependency Failure', email, workspaceRoleId: developerRoleId },
          tokenFor(ownerActor),
        );

        expectInternalServerError(response);
        expect(await fetchRawUserByEmail(email)).toBeNull();
      });
    });
  });
});
