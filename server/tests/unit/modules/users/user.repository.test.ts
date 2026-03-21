import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { UserRepository } from '@/modules/users/user.repository';
import {
  errorCause,
  invalidBulkUpsertUsersDatabaseUsers,
  invalidUser,
  mockBulkUpsertUsersDatabaseUsers,
  mockBulkUpsertUsersParams,
  mockBulkUpsertUsersUsers,
  mockCreateUserParams,
  mockDatabaseUser,
  mockUser,
} from './user.repository.mock';
import { createMockSupabaseClient, MockSupabaseClient } from '../../mocks/supabase.mock';
import { mockLogger } from '../../mocks/logger.mock';
import { createError } from '../../mocks/error.mock';

describe('UserRepository', () => {
  function createUserRepository(mockSupabase: MockSupabaseClient) {
    return new UserRepository(mockSupabase as unknown as SupabaseClient, mockLogger);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user', async () => {
      const mockSupabase = createMockSupabaseClient(mockDatabaseUser);
      const userRepository = createUserRepository(mockSupabase);

      const user = await userRepository.createUser(mockCreateUserParams);

      expect(user).toEqual(mockUser);
    });

    it('should not log an error when the user creation is successful', async () => {
      const mockSupabase = createMockSupabaseClient(mockDatabaseUser);
      const userRepository = createUserRepository(mockSupabase);

      await userRepository.createUser(mockCreateUserParams);

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw an error when the user creation fails', async () => {
      const error = createError('User creation failed', errorCause);

      const mockSupabase = createMockSupabaseClient(null, error);
      const userRepository = createUserRepository(mockSupabase);

      await expect(userRepository.createUser(mockCreateUserParams)).rejects.toMatchObject({
        message: error.message,
        cause: error.cause,
      });
    });

    it('should log an error when the user creation fails', async () => {
      const error = createError('User creation failed', errorCause);

      const mockSupabase = createMockSupabaseClient(null, error);
      const userRepository = createUserRepository(mockSupabase);

      await userRepository.createUser(mockCreateUserParams).catch((err) => err);
      expect(mockLogger.error).toHaveBeenCalledWith(error.message, {
        cause: error.cause,
        stack: error.stack,
      });
    });

    it('should throw a ZodError when database response returns invalid user data', async () => {
      const mockSupabase = createMockSupabaseClient(invalidUser);
      const userRepository = createUserRepository(mockSupabase);

      await expect(userRepository.createUser(mockCreateUserParams)).rejects.toThrow(ZodError);
    });

    it('should not log an error when the database response returns invalid user data', async () => {
      const mockSupabase = createMockSupabaseClient(invalidUser);
      const userRepository = createUserRepository(mockSupabase);

      await userRepository.createUser(mockCreateUserParams).catch((err) => err);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpsertUsers', () => {
    it('should bulk upsert users', async () => {
      const mockSupabase = createMockSupabaseClient(mockBulkUpsertUsersDatabaseUsers);
      const userRepository = createUserRepository(mockSupabase);

      const users = await userRepository.bulkUpsertUsers(mockBulkUpsertUsersParams);

      expect(users).toEqual(mockBulkUpsertUsersUsers);
    });

    it('should not log an error when the bulk upsert users is successful', async () => {
      const mockSupabase = createMockSupabaseClient(mockBulkUpsertUsersDatabaseUsers);
      const userRepository = createUserRepository(mockSupabase);

      await userRepository.bulkUpsertUsers(mockBulkUpsertUsersParams);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw an error when the bulk upsert users fails', async () => {
      const error = createError('Bulk upsert users failed', errorCause);
      const mockSupabase = createMockSupabaseClient(null, error);
      const userRepository = createUserRepository(mockSupabase);

      await expect(userRepository.bulkUpsertUsers(mockBulkUpsertUsersParams)).rejects.toMatchObject(
        {
          message: error.message,
          cause: error.cause,
        },
      );
    });

    it('should log an error when the bulk upsert users fails', async () => {
      const error = createError('Bulk upsert users failed', errorCause);
      const mockSupabase = createMockSupabaseClient(null, error);
      const userRepository = createUserRepository(mockSupabase);

      await userRepository.bulkUpsertUsers(mockBulkUpsertUsersParams).catch((err) => err);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(error.message, {
        cause: error.cause,
        stack: error.stack,
      });
    });

    it('should throw a ZodError when database response returns invalid user data', async () => {
      const mockSupabase = createMockSupabaseClient(invalidBulkUpsertUsersDatabaseUsers);
      const userRepository = createUserRepository(mockSupabase);

      await expect(userRepository.bulkUpsertUsers(mockBulkUpsertUsersParams)).rejects.toThrow(
        ZodError,
      );
    });

    it('should not log an error when the database response returns invalid user data', async () => {
      const mockSupabase = createMockSupabaseClient(invalidBulkUpsertUsersDatabaseUsers);
      const userRepository = createUserRepository(mockSupabase);

      await userRepository.bulkUpsertUsers(mockBulkUpsertUsersParams).catch((err) => err);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
