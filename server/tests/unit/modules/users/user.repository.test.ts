import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { UserRepository } from '@/modules/users/user.repository';
import { mockCreateUserParams, mockDatabaseUser, mockUser } from './user.repository.mock';
import { createMockSupabaseClient, MockSupabaseClient } from '../../mocks/mockSupabase';
import { mockLogger } from '../../mocks/mockLogger';

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
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw an error if the user creation fails', async () => {
      const cause = { code: '23505', detail: 'Key (email) already exists' };
      const error = new Error('User creation failed', { cause });

      const mockSupabase = createMockSupabaseClient(null, error);
      const userRepository = createUserRepository(mockSupabase);

      await expect(userRepository.createUser(mockCreateUserParams)).rejects.toMatchObject({
        message: error.message,
        cause,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(error.message, {
        cause: error.cause,
        stack: error.stack,
      });
    });

    it('should throw a ZodError when database response returns invalid user data', async () => {
      const invalidUser = {
        ...mockDatabaseUser,
        name: 123,
      };
      const mockSupabase = createMockSupabaseClient(invalidUser);
      const userRepository = createUserRepository(mockSupabase);

      await expect(userRepository.createUser(mockCreateUserParams)).rejects.toThrow(ZodError);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
