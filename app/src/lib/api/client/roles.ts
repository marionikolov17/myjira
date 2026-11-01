import { transport } from '@/lib/api/transport';

export const rolesClient = {
  listWorkspaceRoles: () => transport.listWorkspaceRoles(),
  listProjectRoles: () => transport.listProjectRoles(),
};
