import { User } from '@/modules/users';

export const VALID_EMAIL = 'test@test.com';
export const WRONG_EMAIL = 'wrong@test.com';
export const VALID_PASSWORD = 'password';
export const WRONG_PASSWORD = 'wrong-password';
export const HASHED_PASSWORD = 'hashed-password';
export const GENERATED_TOKEN = 'token';

export const mockUserWithPassword: User & { password: string } = {
  id: '1',
  email: VALID_EMAIL,
  password: HASHED_PASSWORD,
  workspaceRoleId: '1',
  name: 'test',
  createdAt: new Date('2026-03-21'),
  updatedAt: new Date('2026-03-21'),
};
