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

import { prisma } from '@/common/lib/prisma';
import { createTestApp } from '@/common/utils/create-test-app';
import {
  WorkspaceRole,
  WorkspaceRoleName,
  workspaceRoleRepository,
} from '@/modules/workspace-roles';

import {
  expectNoUsersInDatabase,
  expectUsersInDatabase,
  expectUsersResponse,
  expectUsersToNotContainPasswords,
} from './workspace.controller.assertions';
import {
  createWorkspaceTestContext,
  testUsers,
  WorkspaceTestContext,
} from './workspace.controller.fixtures';
import {
  expectConflictError,
  expectForbiddenError,
  expectInternalServerError,
  expectResourceNotFoundError,
} from '../../assertions/errors.assertions';
import {
  deleteAllWorkspaceRoles,
  ensureWorkspaceRolesSeeded,
  fetchAllWorkspaceRoles,
  seedOnlyWorkspaceRoles,
} from '../../fixtures/workspace-roles.fixtures';

describe('Workspace Controller', () => {
  let app: Application;
  let ctx: WorkspaceTestContext;

  beforeAll(async () => {
    ctx = createWorkspaceTestContext();
    app = createTestApp(ctx.controller.router);

    await ensureWorkspaceRolesSeeded();
  });

  afterAll(async () => {
    jest.restoreAllMocks();

    await prisma.user.deleteMany();
    await deleteAllWorkspaceRoles();
    await prisma.$disconnect();
  });

  describe('POST /bootstrap', () => {
    function bootstrapWorkspaceUsers(body: unknown) {
      return supertest(app)
        .post('/bootstrap')
        .send(body as object);
    }

    function validBootstrap() {
      return bootstrapWorkspaceUsers({
        bootstrapToken: ctx.bootstrapToken,
      });
    }

    beforeEach(async () => {
      await prisma.user.deleteMany();
    });

    describe('on success', () => {
      let workspaceRoles: WorkspaceRole[];

      beforeEach(async () => {
        workspaceRoles = await fetchAllWorkspaceRoles();
      });

      it('creates the workspace users when a valid bootstrap token is provided', async () => {
        const response = await validBootstrap();

        expect(response.status).toBe(201);

        const users = response.body.data;
        expectUsersToNotContainPasswords(users);
        expectUsersResponse(users, workspaceRoles, testUsers);

        await expectUsersInDatabase(testUsers);
      });
    });

    // TODO: replace with business-rule violation once the service stops
    // delegating uniqueness enforcement to Prisma's unique constraint.
    describe.skip('on already-bootstrapped workspace', () => {
      it('returns a conflict error when a second bootstrap attempt is made and leaves the original users intact', async () => {
        const firstResponse = await validBootstrap();
        expect(firstResponse.status).toBe(201);

        const secondResponse = await validBootstrap();
        expectConflictError(secondResponse);

        await expectUsersInDatabase(testUsers);
      });
    });

    describe('on invalid bootstrap token', () => {
      it('returns a forbidden error when a syntactically valid but incorrect token is provided', async () => {
        const response = await bootstrapWorkspaceUsers({ bootstrapToken: 'invalid-token' });

        expectForbiddenError(response);
        await expectNoUsersInDatabase();
      });
    });

    // TODO: once schema validation surfaces ValidationError instead of bubbling
    // Zod failures, switch these assertions to `expectValidationError`.
    describe.skip('on malformed request body', () => {
      it.each([
        { case: 'bootstrap token is undefined', body: { bootstrapToken: undefined } },
        { case: 'bootstrap token is omitted', body: {} },
        { case: 'request body is undefined', body: undefined },
        { case: 'bootstrap token is numeric', body: { bootstrapToken: 123 } },
        { case: 'bootstrap token is boolean', body: { bootstrapToken: true } },
        { case: 'bootstrap token is null', body: { bootstrapToken: null } },
        { case: 'bootstrap token is empty', body: { bootstrapToken: '' } },
      ])(`returns temporarily an internal server error when $case`, async ({ body }) => {
        const response = await bootstrapWorkspaceUsers(body);

        expectInternalServerError(response);
        await expectNoUsersInDatabase();
      });
    });

    describe('on missing workspace roles', () => {
      afterEach(async () => {
        await ensureWorkspaceRolesSeeded();
      });

      it('returns a resource not found error when no workspace roles are seeded', async () => {
        await deleteAllWorkspaceRoles();

        const response = await validBootstrap();

        expectResourceNotFoundError(response, workspaceRoleRepository.resourceName);
        await expectNoUsersInDatabase();
      });

      it.each(
        Object.values(WorkspaceRoleName).map((role) => ({ label: role.toLowerCase(), role })),
      )(
        'returns a resource not found error when not all workspace roles are seeded (missing $label)',
        async ({ role }) => {
          const presentRoles = Object.values(WorkspaceRoleName).filter((r) => r !== role);
          await seedOnlyWorkspaceRoles(presentRoles);

          const response = await validBootstrap();

          expectResourceNotFoundError(response, workspaceRoleRepository.resourceName);
          await expectNoUsersInDatabase();
        },
      );
    });

    describe('on repository failure', () => {
      afterEach(async () => {
        jest.restoreAllMocks();
      });

      it('returns an internal server error when the user repository throws an unexpected error', async () => {
        jest
          .spyOn(ctx.userRepository, 'bulkCreateUsers')
          .mockRejectedValue(new Error('database unavailable'));

        const response = await validBootstrap();

        expectInternalServerError(response);
        await expectNoUsersInDatabase();
      });

      it('returns an internal server error when the workspace role repository throws an unexpected error', async () => {
        jest
          .spyOn(ctx.workspaceRoleRepository, 'getWorkspaceRoles')
          .mockRejectedValue(new Error('Failed to get workspace roles'));

        const response = await validBootstrap();

        expectInternalServerError(response);
        await expectNoUsersInDatabase();
      });
    });
  });
});
