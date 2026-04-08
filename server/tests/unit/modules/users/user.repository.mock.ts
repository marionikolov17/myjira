import { UserSchema } from '@/modules/users/user.schema';

const FIXED_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const FIXED_WORKSPACE_ROLE_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

export const mockCreateUserParams = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  hashedPassword: 'hashedPassword',
  workspaceRoleId: FIXED_WORKSPACE_ROLE_ID,
};

export const mockBulkCreateUsersParams = {
  users: [mockCreateUserParams],
};

export const mockDatabaseUser = {
  id: FIXED_USER_ID,
  name: mockCreateUserParams.name,
  email: mockCreateUserParams.email,
  workspace_role_id: FIXED_WORKSPACE_ROLE_ID,
  created_at: FIXED_DATE,
  updated_at: FIXED_DATE,
};
export const mockUser = UserSchema.parse(mockDatabaseUser);

export const mockBulkCreateUsersDatabaseUsers = [mockDatabaseUser];
export const mockBulkCreateUsersUsers = [mockUser];

export const errorCause = { code: '23505', detail: 'Key (email) already exists' };
export const invalidUser = {
  ...mockDatabaseUser,
  name: 123,
};

export const invalidBulkCreateUsersDatabaseUsers = [invalidUser];
