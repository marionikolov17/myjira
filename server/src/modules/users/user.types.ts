export interface CreateUserParams {
  name: string;
  email: string;
  hashedPassword: string;
  workspaceRoleId: string;
}
