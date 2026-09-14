import { ActorContext } from '@/common/interfaces';
import { ActivationToken } from '@/common/activation-token';
import { UserStatus } from '@/generated/prisma/enums';
import { WorkspaceRole, WorkspaceRoleName } from '@/modules/workspace-roles';
import { CreateUserRequestParams, User } from '@/modules/users';
import { UserServiceConfig } from '@/modules/users/user.types';

export const OWNER_ROLE_ID = '11111111-1111-1111-1111-111111111111';
export const DEVELOPER_ROLE_ID = '22222222-2222-2222-2222-222222222222';
export const ACTOR_USER_ID = '33333333-3333-3333-3333-333333333333';
export const ACTOR_WORKSPACE_ROLE_ID = OWNER_ROLE_ID;
export const CREATED_USER_ID = '44444444-4444-4444-4444-444444444444';

export const RAW_TOKEN = 'raw-activation-token-value';
export const TOKEN_HASH = 'sha256-hash-of-raw-token';
export const EXPIRES_AT = new Date('2026-02-01T00:00:00.000Z');

export const ACTIVATION_URL_BASE = 'https://app.example.com/activate';

export const userServiceConfig: UserServiceConfig = {
  activationUrlBase: ACTIVATION_URL_BASE,
};

export const ownerActor: ActorContext = {
  userId: ACTOR_USER_ID,
  workspaceRole: { id: ACTOR_WORKSPACE_ROLE_ID, name: WorkspaceRoleName.OWNER },
  projectRoles: [],
};

export const validInput: CreateUserRequestParams = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  workspaceRoleId: DEVELOPER_ROLE_ID,
};

export const developerRole: WorkspaceRole = {
  id: DEVELOPER_ROLE_ID,
  name: WorkspaceRoleName.DEVELOPER,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const ownerRole: WorkspaceRole = {
  id: OWNER_ROLE_ID,
  name: WorkspaceRoleName.OWNER,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const generatedActivationToken: ActivationToken = {
  token: RAW_TOKEN,
  tokenHash: TOKEN_HASH,
  expiresAt: EXPIRES_AT,
};

export const createdUser: User = {
  id: CREATED_USER_ID,
  name: validInput.name,
  email: validInput.email,
  workspaceRoleId: DEVELOPER_ROLE_ID,
  status: UserStatus.Pending,
  createdAt: new Date('2026-01-15T00:00:00.000Z'),
  updatedAt: new Date('2026-01-15T00:00:00.000Z'),
};
