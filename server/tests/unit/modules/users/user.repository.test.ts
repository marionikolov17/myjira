import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { UserRepository } from '@/modules/users/user.repository';
import {
  errorCause,
  invalidUser,
  mockCreateUserParams,
  mockDatabaseUser,
  mockUser,
} from './user.repository.mock';
import { createMockSupabaseClient, MockSupabaseClient } from '../../mocks/mockSupabase';
import { mockLogger } from '../../mocks/mockLogger';
import { createError } from '../../mocks/mockError';

describe('UserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    function createUserRepository(mockSupabase: MockSupabaseClient) {
      return new UserRepository(mockSupabase as unknown as SupabaseClient, mockLogger);
    }

    it('should create a user', async () => {
      const mockSupabase = createMockSupabaseClient(mockDatabaseUser);
      const userRepository = createUserRepository(mockSupabase);

      const user = await userRepository.createUser(mockCreateUserParams);

      expect(user).toEqual(mockUser);
    });

    it('should call supabase methods with the correct parameters', async () => {
      const mockSupabase = createMockSupabaseClient(mockDatabaseUser);
      const userRepository = createUserRepository(mockSupabase);

      await userRepository.createUser(mockCreateUserParams);

      expect(mockSupabase['from']).toHaveBeenCalledWith('users');
      expect(mockSupabase['insert']).toHaveBeenCalledWith({
        name: mockCreateUserParams.name,
        email: mockCreateUserParams.email,
        password: mockCreateUserParams.hashedPassword,
        workspace_role_id: mockCreateUserParams.workspaceRoleId,
      });
      expect(mockSupabase['select']).toHaveBeenCalledWith(
        'id, name, email, workspace_role_id, created_at, updated_at',
      );
      expect(mockSupabase['single']).toHaveBeenCalled();
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
});
