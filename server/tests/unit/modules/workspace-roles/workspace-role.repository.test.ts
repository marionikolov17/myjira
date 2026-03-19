import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { WorkspaceRoleRepository } from '@/modules/workspace-roles/workspace-role.repository';
import { WorkspaceRoleSchema } from '@/modules/workspace-roles/workspace-role.schema';
import {
  errorCause,
  invalidWorkspaceRole,
  mockDatabaseWorkspaceRoles,
} from './workspace-role.repository.mock';
import { createMockSupabaseClient } from '../../mocks/mockSupabase';
import { mockLogger } from '../../mocks/mockLogger';
import { createError } from '../../mocks/mockError';

describe('WorkspaceRoleRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWorkspaceRoles', () => {
    it('should return the workspace roles', async () => {
      const mockSupabase = createMockSupabaseClient(mockDatabaseWorkspaceRoles);
      const workspaceRoleRepository = new WorkspaceRoleRepository(
        mockSupabase as unknown as SupabaseClient,
        mockLogger,
      );

      const workspaceRoles = await workspaceRoleRepository.getWorkspaceRoles();

      expect(workspaceRoles).toEqual(
        mockDatabaseWorkspaceRoles.map((role) => WorkspaceRoleSchema.parse(role)),
      );
    });

    it('should call supabase methods with the correct parameters', async () => {
      const mockSupabase = createMockSupabaseClient(mockDatabaseWorkspaceRoles);
      const workspaceRoleRepository = new WorkspaceRoleRepository(
        mockSupabase as unknown as SupabaseClient,
        mockLogger,
      );

      await workspaceRoleRepository.getWorkspaceRoles();

      expect(mockSupabase['from']).toHaveBeenCalledWith('workspace_roles');
      expect(mockSupabase['select']).toHaveBeenCalledWith('id, name, created_at, updated_at');
    });

    it('should not log an error when the database returns workspace roles', async () => {
      const mockSupabase = createMockSupabaseClient(mockDatabaseWorkspaceRoles);
      const workspaceRoleRepository = new WorkspaceRoleRepository(
        mockSupabase as unknown as SupabaseClient,
        mockLogger,
      );

      await workspaceRoleRepository.getWorkspaceRoles();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw an error when the database returns an error', async () => {
      const error = createError('Database error', errorCause);

      const mockSupabase = createMockSupabaseClient(null, error);
      const workspaceRoleRepository = new WorkspaceRoleRepository(
        mockSupabase as unknown as SupabaseClient,
        mockLogger,
      );

      await expect(workspaceRoleRepository.getWorkspaceRoles()).rejects.toMatchObject({
        message: error.message,
        cause: error.cause,
      });
    });

    it('should log an error when the database returns an error', async () => {
      const error = createError('Database error', errorCause);

      const mockSupabase = createMockSupabaseClient(null, error);
      const workspaceRoleRepository = new WorkspaceRoleRepository(
        mockSupabase as unknown as SupabaseClient,
        mockLogger,
      );

      await workspaceRoleRepository.getWorkspaceRoles().catch((err) => err);
      expect(mockLogger.error).toHaveBeenCalledWith(error.message, {
        cause: error.cause,
        stack: error.stack,
      });
    });

    it('should throw a ZodError when database response returns invalid workspace role data', async () => {
      const mockSupabase = createMockSupabaseClient([invalidWorkspaceRole]);
      const workspaceRoleRepository = new WorkspaceRoleRepository(
        mockSupabase as unknown as SupabaseClient,
        mockLogger,
      );

      await expect(workspaceRoleRepository.getWorkspaceRoles()).rejects.toThrow(ZodError);
    });

    it('should not log an error when the database response returns invalid workspace role data', async () => {
      const mockSupabase = createMockSupabaseClient([invalidWorkspaceRole]);
      const workspaceRoleRepository = new WorkspaceRoleRepository(
        mockSupabase as unknown as SupabaseClient,
        mockLogger,
      );

      await workspaceRoleRepository.getWorkspaceRoles().catch((err) => err);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
