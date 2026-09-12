import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import supertest from 'supertest';

import { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { ProjectRoleName } from '@/modules/project-members';
import { WorkspaceRoleName } from '@/modules/workspace-roles';

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

    function tokenFor(actor: ActorContext): string {
      return bearer(
        ctx.tokenService.generateToken({
          userId: actor.userId,
          workspaceRoleId: actor.workspaceRole.id,
        }),
      );
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
