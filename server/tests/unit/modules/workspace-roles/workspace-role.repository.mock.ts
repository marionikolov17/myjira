import {
  WorkspaceRoleName,
  WorkspaceRoleSchema,
} from '@/modules/workspace-roles/workspace-role.schema';

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');
export const mockDatabaseWorkspaceRoles = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: WorkspaceRoleName.OWNER,
    created_at: FIXED_DATE,
    updated_at: FIXED_DATE,
  },
  {
    id: '550e8500-e29b-41d4-a716-446655440000',
    name: WorkspaceRoleName.ADMIN,
    created_at: FIXED_DATE,
    updated_at: FIXED_DATE,
  },
  {
    id: '550e8600-e29b-41d4-a716-446655440000',
    name: WorkspaceRoleName.DEVELOPER,
    created_at: FIXED_DATE,
    updated_at: FIXED_DATE,
  },
];
export const mockWorkspaceRoles = mockDatabaseWorkspaceRoles.map((role) =>
  WorkspaceRoleSchema.parse(role),
);

export const errorCause = { code: '500', detail: 'Database error' };
export const invalidWorkspaceRole = {
  ...mockDatabaseWorkspaceRoles[0],
  name: 123,
};
