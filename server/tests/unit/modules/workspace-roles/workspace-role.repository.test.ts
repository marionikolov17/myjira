import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { WorkspaceRoleRepository } from '@/modules/workspace-roles/workspace-role.repository';
import {
  errorCause,
  invalidWorkspaceRole,
  mockDatabaseWorkspaceRoles,
  mockWorkspaceRoles,
} from './workspace-role.repository.mock';
import { createMockSupabaseClient, MockSupabaseClient } from '../../mocks/supabase.mock';
import { mockLogger } from '../../mocks/logger.mock';
import { createError } from '../../mocks/error.mock';

describe('WorkspaceRoleRepository', () => {
  function createWorkspaceRoleRepository(mockSupabase: MockSupabaseClient) {
    return new WorkspaceRoleRepository(mockSupabase as unknown as SupabaseClient, mockLogger);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWorkspaceRoles', () => {
    it('should return the workspace roles', async () => {
      const mockSupabase = createMockSupabaseClient(mockDatabaseWorkspaceRoles);
      const workspaceRoleRepository = createWorkspaceRoleRepository(mockSupabase);

      const workspaceRoles = await workspaceRoleRepository.getWorkspaceRoles();

      expect(workspaceRoles).toEqual(mockWorkspaceRoles);
    });

    it('should not log an error when the database returns workspace roles', async () => {
      const mockSupabase = createMockSupabaseClient(mockDatabaseWorkspaceRoles);
      const workspaceRoleRepository = createWorkspaceRoleRepository(mockSupabase);

      await workspaceRoleRepository.getWorkspaceRoles();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw an error when the database returns an error', async () => {
      const error = createError('Database error', errorCause);

      const mockSupabase = createMockSupabaseClient(null, error);
      const workspaceRoleRepository = createWorkspaceRoleRepository(mockSupabase);

      await expect(workspaceRoleRepository.getWorkspaceRoles()).rejects.toThrow(Error);
    });

    it('should log an error when the database returns an error', async () => {
      const error = createError('Database error', errorCause);

      const mockSupabase = createMockSupabaseClient(null, error);
      const workspaceRoleRepository = createWorkspaceRoleRepository(mockSupabase);

      await workspaceRoleRepository.getWorkspaceRoles().catch((err) => err);
      expect(mockLogger.error).toHaveBeenCalledWith(error.message, {
        cause: error.cause,
        stack: error.stack,
      });
    });

    it('should throw a ZodError when database response returns invalid workspace role data', async () => {
      const mockSupabase = createMockSupabaseClient([invalidWorkspaceRole]);
      const workspaceRoleRepository = createWorkspaceRoleRepository(mockSupabase);

      await expect(workspaceRoleRepository.getWorkspaceRoles()).rejects.toThrow(ZodError);
    });

    it('should not log an error when the database response returns invalid workspace role data', async () => {
      const mockSupabase = createMockSupabaseClient([invalidWorkspaceRole]);
      const workspaceRoleRepository = createWorkspaceRoleRepository(mockSupabase);

      await workspaceRoleRepository.getWorkspaceRoles().catch((err) => err);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
