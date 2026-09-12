import { CreatedUser } from './user.schema';

/* 
==============================
Repository User Types
==============================
*/
export interface CreateUserParams {
  name: string;
  email: string;
  workspaceRoleId: string;
  activationTokenHash: string;
  activationTokenExpiresAt: Date;
}

export interface BulkCreateUserParams {
  name: string;
  email: string;
  hashedPassword: string;
  workspaceRoleId: string;
}

export interface BulkCreateUsersParams {
  users: BulkCreateUserParams[];
}

export interface HasUsersForWorkspaceRoleIdsParams {
  workspaceRoleIds: string[];
}

/* 
==============================
User Service Types
==============================
*/

export interface CreateUserResult {
  user: CreatedUser;
  activation: ActivationLink;
}

export interface ActivationLink {
  url: string;
  expiresAt: Date;
}

export interface UserServiceConfig {
  activationUrlBase: string;
}
