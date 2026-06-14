import { beforeAll, describe, it, jest } from '@jest/globals';
import supertest from 'supertest';

import { Application } from 'express';

import { createTestApp } from '@/common/utils/create-test-app';

import { createTestUsers } from '../../fixtures/users.fixtures';
import { ensureWorkspaceRolesSeeded } from '../../fixtures/workspace-roles.fixtures';

import {
  expectInternalServerError,
  expectInvalidLoginCredentialsError,
  expectValidationError,
} from '../../assertions/errors.assertions';

import {
  createAuthTestContext,
  AuthTestContext,
  testUsers,
  primaryTestUser,
  denormalizedEmailVariants,
  nonMatchingPasswordVariants,
  TOKEN_EXPIRES_IN_SECONDS,
} from './auth.controller.fixtures';
import { expectSuccessfulLogin, expectTokenPayload } from './auth.controller.assertions';

describe('Auth Controller', () => {
  let app: Application;
  let ctx: AuthTestContext;

  beforeAll(async () => {
    ctx = createAuthTestContext();
    app = createTestApp(ctx.controller.router);

    await ensureWorkspaceRolesSeeded();
    await createTestUsers(testUsers);
  });

  describe('POST /login', () => {
    async function login(body: Record<string, unknown> | undefined | string | unknown[]) {
      return supertest(app).post('/login').send(body);
    }

    describe('on success', () => {
      it.each(testUsers)(
        `returns a token with user id, workspace role id, iat and exp in the payload when valid credentials are provided for user with workspace role $workspaceRoleName`,
        async (user) => {
          const response = await login({ email: user.email, password: user.password });

          expectSuccessfulLogin(response);
          await expectTokenPayload(
            ctx.tokenService.verifyToken(response.body.data.token),
            user,
            TOKEN_EXPIRES_IN_SECONDS,
          );
        },
      );
    });

    describe('on denormalized email', () => {
      it.each(denormalizedEmailVariants(primaryTestUser.email))(
        'normalizes a $case email and returns a token for the matching user',
        async ({ email }) => {
          const response = await login({ email, password: primaryTestUser.password });

          expectSuccessfulLogin(response);
          await expectTokenPayload(
            ctx.tokenService.verifyToken(response.body.data.token),
            primaryTestUser,
            TOKEN_EXPIRES_IN_SECONDS,
          );
        },
      );
    });

    describe('on invalid credentials', () => {
      it.each([
        {
          email: 'wrong-email@example.com',
          password: primaryTestUser.password,
          case: 'wrong email',
        },
        { email: primaryTestUser.email, password: 'wrong-password', case: 'wrong password' },
        {
          email: 'wrong-email@example.com',
          password: 'wrong-password',
          case: 'wrong email and password',
        },
      ])(`returns an unauthorized error when $case`, async ({ email, password }) => {
        const response = await login({ email, password });

        expectInvalidLoginCredentialsError(response);
      });
    });

    describe('on password that is not an exact match', () => {
      it.each(nonMatchingPasswordVariants(primaryTestUser.password))(
        'rejects a $case password because passwords are case- and whitespace-sensitive',
        async ({ password }) => {
          const response = await login({ email: primaryTestUser.email, password });

          expectInvalidLoginCredentialsError(response);
        },
      );
    });

    describe('on malformed request body', () => {
      it.each([
        {
          case: 'email is undefined',
          body: { email: undefined, password: 'test-password' },
          expectedFields: ['email'],
        },
        {
          case: 'email is omitted',
          body: { password: 'test-password' },
          expectedFields: ['email'],
        },
        {
          case: 'email is not a valid email',
          body: { email: 'not-an-email', password: 'test-password' },
          expectedFields: ['email'],
        },
        {
          case: 'email is empty',
          body: { email: '', password: 'test-password' },
          expectedFields: ['email'],
        },
        {
          case: 'email is numeric',
          body: { email: 123, password: 'test-password' },
          expectedFields: ['email'],
        },
        {
          case: 'email is boolean',
          body: { email: true, password: 'test-password' },
          expectedFields: ['email'],
        },
        {
          case: 'password is undefined',
          body: { email: 'test-email@example.com', password: undefined },
          expectedFields: ['password'],
        },
        {
          case: 'password is omitted',
          body: { email: 'test-email@example.com' },
          expectedFields: ['password'],
        },
        {
          case: 'password is empty',
          body: { email: 'test-email@example.com', password: '' },
          expectedFields: ['password'],
        },
        {
          case: 'password is numeric',
          body: { email: 'test-email@example.com', password: 123 },
          expectedFields: ['password'],
        },
        {
          case: 'password is boolean',
          body: { email: 'test-email@example.com', password: true },
          expectedFields: ['password'],
        },
        {
          case: 'email and password are empty',
          body: { email: '', password: '' },
          expectedFields: ['email', 'password'],
        },
        {
          case: 'request body is undefined',
          body: undefined,
          expectedFields: ['email', 'password'],
        },
        {
          case: 'request body is not an object',
          body: [],
          expectedFields: ['email', 'password'],
        },
        {
          case: 'request body is an object with additional fields',
          body: {
            email: 'test-email@example.com',
            password: 'test-password',
            additionalField: 'additionalField',
          },
          expectedFields: ['additionalField'],
        },
      ])(`returns a validation error when $case`, async ({ body, expectedFields }) => {
        const response = await login(body);
        expectValidationError(response, expectedFields);
      });
    });

    describe('on unexpected dependency failure', () => {
      it.each([
        {
          case: 'the user repository throws',
          arrange: () =>
            jest
              .spyOn(ctx.userRepository, 'getUserByEmailWithPassword')
              .mockRejectedValue(new Error('database unavailable')),
        },
        {
          case: 'the password hasher throws',
          arrange: () =>
            jest
              .spyOn(ctx.passwordHasher, 'verifyPassword')
              .mockRejectedValue(new Error('hash comparison failed')),
        },
        {
          case: 'the token service throws',
          arrange: () =>
            jest.spyOn(ctx.tokenService, 'generateToken').mockImplementation(() => {
              throw new Error('token signing failed');
            }),
        },
      ])('returns an internal server error when $case', async ({ arrange }) => {
        arrange();

        const response = await login({
          email: primaryTestUser.email,
          password: primaryTestUser.password,
        });

        expectInternalServerError(response);
      });
    });
  });
});
