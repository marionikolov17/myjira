import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import supertest from 'supertest';

import { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { ProjectRoleName } from '@/modules/project-members';

import { createTestUsers } from '../../fixtures/users.fixtures';
import { ensureWorkspaceRolesSeeded } from '../../fixtures/workspace-roles.fixtures';
import {
  addUserToNewProject,
  ensureProjectRolesSeeded,
  SeededProjectMembership,
} from '../../fixtures/project-members.fixtures';

import {
  expectAuthenticationRequired,
  expectInternalServerError,
} from '../../assertions/errors.assertions';

import {
  createExpiredToken,
  createTokenWithWrongSecret,
  createUsersTestContext,
  fetchPersistedUser,
  testUsers,
  UsersTestContext,
} from './users.controller.fixtures';
import { expectActorContextResponse } from './users.controller.assertions';

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
});
