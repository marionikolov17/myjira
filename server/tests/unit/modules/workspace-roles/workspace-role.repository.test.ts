import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { WorkspaceRoleRepository } from '@/modules/workspace-roles/workspace-role.repository';
import { WorkspaceRoleSchema } from '@/modules/workspace-roles/workspace-role.schema';
import { mockDatabaseWorkspaceRoles } from './workspace-role.repository.mock';
import { createMockSupabaseClient } from '../../mocks/mockSupabase';
import { mockLogger } from '../../mocks/mockLogger';

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
      expect(mockSupabase['from']).toHaveBeenCalledWith('workspace_roles');
      expect(mockSupabase['select']).toHaveBeenCalledWith('id, name, created_at, updated_at');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw an error if the database returns an error', async () => {
      const cause = { code: '500', detail: 'Database error' };
      const error = new Error('Database error', { cause });

      const mockSupabase = createMockSupabaseClient(null, error);
      const workspaceRoleRepository = new WorkspaceRoleRepository(
        mockSupabase as unknown as SupabaseClient,
        mockLogger,
      );

      await expect(workspaceRoleRepository.getWorkspaceRoles()).rejects.toMatchObject({
        message: error.message,
        cause,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(error.message, {
        cause: error.cause,
        stack: error.stack,
      });
    });

    it('should throw a ZodError when database response returns invalid workspace role data', async () => {
      const invalidWorkspaceRole = {
        ...mockDatabaseWorkspaceRoles[0],
        name: 123,
      };
      const mockSupabase = createMockSupabaseClient([invalidWorkspaceRole]);
      const workspaceRoleRepository = new WorkspaceRoleRepository(
        mockSupabase as unknown as SupabaseClient,
        mockLogger,
      );

      await expect(workspaceRoleRepository.getWorkspaceRoles()).rejects.toThrow(ZodError);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
