export interface CreateUserParams {
  name: string;
  email: string;
  hashedPassword: string;
  workspaceRoleId: string;
}

export interface BulkCreateUsersParams {
  users: CreateUserParams[];
}

export interface HasUsersForWorkspaceRoleIdsParams {
  workspaceRoleIds: string[];
}
