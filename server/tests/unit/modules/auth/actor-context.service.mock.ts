import { TokenPayload } from '@/common/token-service';
import { User } from '@/modules/users';
import { WorkspaceRole, WorkspaceRoleName } from '@/modules/workspace-roles';
import { ProjectMemberWithRole, ProjectRoleName } from '@/modules/project-members';

export const USER_ID = '11111111-1111-1111-1111-111111111111';
export const WORKSPACE_ROLE_ID = '22222222-2222-2222-2222-222222222222';

export const mockTokenPayload: TokenPayload = {
  userId: USER_ID,
  workspaceRoleId: WORKSPACE_ROLE_ID,
  iat: 1_700_000_000,
  exp: 1_700_003_600,
};

export const mockUser: User = {
  id: USER_ID,
  name: 'Actor User',
  email: 'actor@example.com',
  workspaceRoleId: WORKSPACE_ROLE_ID,
  createdAt: new Date('2026-03-21'),
  updatedAt: new Date('2026-03-21'),
};

export const mockWorkspaceRole: WorkspaceRole = {
  id: WORKSPACE_ROLE_ID,
  name: WorkspaceRoleName.OWNER,
  createdAt: new Date('2026-03-21'),
  updatedAt: new Date('2026-03-21'),
};

export const mockProjectMembers: ProjectMemberWithRole[] = [
  {
    id: '33333333-3333-3333-3333-333333333333',
    projectId: '44444444-4444-4444-4444-444444444444',
    userId: USER_ID,
    projectRoleId: '55555555-5555-5555-5555-555555555555',
    projectRole: {
      id: '55555555-5555-5555-5555-555555555555',
      name: ProjectRoleName.PROJECT_OWNER,
    },
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    projectId: '77777777-7777-7777-7777-777777777777',
    userId: USER_ID,
    projectRoleId: '88888888-8888-8888-8888-888888888888',
    projectRole: {
      id: '88888888-8888-8888-8888-888888888888',
      name: ProjectRoleName.DEVELOPER,
    },
  },
];
