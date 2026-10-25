import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { ProjectRoleName } from '@/modules/project-roles';

export interface ActorWorkspaceRole {
  id: string;
  name: WorkspaceRoleName;
}

export interface ActorProjectRole {
  projectId: string;
  projectRoleId: string;
  projectRoleName: ProjectRoleName;
}

export interface ActorContext {
  userId: string;
  workspaceRole: ActorWorkspaceRole;
  projectRoles: ActorProjectRole[];
}
