import type { CreateUserInput, ListQuery, UpdateUserRoleInput } from '@/lib/api/schemas';
import { transport } from '@/lib/api/transport';

export const usersClient = {
  create: (input: CreateUserInput) => transport.createUser(input),
  list: (query: ListQuery = {}) => transport.listUsers(query),
  getById: (id: string) => transport.getUserById(id),
  updateRole: (id: string, input: UpdateUserRoleInput) => transport.updateUserRole(id, input),
};
