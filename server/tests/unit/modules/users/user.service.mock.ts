import { ActorContext } from '@/common/interfaces';
import { ActivationToken } from '@/common/activation-token';
import { UserStatus } from '@/generated/prisma/enums';
import { WorkspaceRole, WorkspaceRoleName } from '@/modules/workspace-roles';
import { CreateUserRequestParams, UpdateUserRoleRequestParams, User } from '@/modules/users';
import { UserServiceConfig } from '@/modules/users/user.types';

export const OWNER_ROLE_ID = '11111111-1111-1111-1111-111111111111';
export const DEVELOPER_ROLE_ID = '22222222-2222-2222-2222-222222222222';
export const ADMIN_ROLE_ID = '55555555-5555-5555-5555-555555555555';
export const ACTOR_USER_ID = '33333333-3333-3333-3333-333333333333';
export const ACTOR_WORKSPACE_ROLE_ID = OWNER_ROLE_ID;
export const CREATED_USER_ID = '44444444-4444-4444-4444-444444444444';
export const TARGET_USER_ID = '66666666-6666-6666-6666-666666666666';
export const UNKNOWN_ROLE_ID = '77777777-7777-7777-7777-777777777777';

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

export const adminRole: WorkspaceRole = {
  id: ADMIN_ROLE_ID,
  name: WorkspaceRoleName.ADMIN,
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

/* 
==============================
updateUserRole fixtures
==============================
*/

export const developerTargetUser: User = {
  id: TARGET_USER_ID,
  name: 'Grace Hopper',
  email: 'grace@example.com',
  workspaceRoleId: DEVELOPER_ROLE_ID,
  status: UserStatus.Active,
  createdAt: new Date('2026-01-10T00:00:00.000Z'),
  updatedAt: new Date('2026-01-10T00:00:00.000Z'),
};

export const adminTargetUser: User = {
  ...developerTargetUser,
  workspaceRoleId: ADMIN_ROLE_ID,
};

export const ownerTargetUser: User = {
  ...developerTargetUser,
  workspaceRoleId: OWNER_ROLE_ID,
};

export const pendingDeveloperTargetUser: User = {
  ...developerTargetUser,
  status: UserStatus.Pending,
};

export const promoteToAdminInput: UpdateUserRoleRequestParams = {
  workspaceRoleId: ADMIN_ROLE_ID,
};

export const demoteToDeveloperInput: UpdateUserRoleRequestParams = {
  workspaceRoleId: DEVELOPER_ROLE_ID,
};

export const assignOwnerInput: UpdateUserRoleRequestParams = {
  workspaceRoleId: OWNER_ROLE_ID,
};

export const assignUnknownRoleInput: UpdateUserRoleRequestParams = {
  workspaceRoleId: UNKNOWN_ROLE_ID,
};

export const promotedToAdminUser: User = {
  ...developerTargetUser,
  workspaceRoleId: ADMIN_ROLE_ID,
  updatedAt: new Date('2026-02-01T00:00:00.000Z'),
};

export const demotedToDeveloperUser: User = {
  ...adminTargetUser,
  workspaceRoleId: DEVELOPER_ROLE_ID,
  updatedAt: new Date('2026-02-01T00:00:00.000Z'),
};

export const promotedPendingUser: User = {
  ...pendingDeveloperTargetUser,
  workspaceRoleId: ADMIN_ROLE_ID,
  updatedAt: new Date('2026-02-01T00:00:00.000Z'),
};
