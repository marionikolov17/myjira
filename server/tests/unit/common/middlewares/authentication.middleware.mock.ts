import { ActorContext } from '@/common/interfaces';
import { TokenPayload } from '@/common/token-service';
import { WorkspaceRoleName } from '@/modules/workspace-roles';

export const VALID_TOKEN = 'valid.jwt.token';

export const mockTokenPayload: TokenPayload = {
  userId: 'user-id',
  workspaceRoleId: 'workspace-role-id',
  iat: 1_700_000_000,
  exp: 1_700_003_600,
};

export const mockActorContext: ActorContext = {
  userId: 'user-id',
  workspaceRole: { id: 'workspace-role-id', name: WorkspaceRoleName.OWNER },
  projectRoles: [],
};
