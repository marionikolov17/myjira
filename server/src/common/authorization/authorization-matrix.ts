import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { ProjectRoleName } from '@/modules/project-members';
import { AuthorizationAction, AuthorizationScope } from './authorization.types';

export type ProjectActionConfig =
  | ProjectRoleName[]
  | { projectRoles: ProjectRoleName[]; workspaceBypass?: WorkspaceRoleName[] };

export interface AuthorizationMatrix {
  [AuthorizationScope.Workspace]: Partial<Record<AuthorizationAction, WorkspaceRoleName[]>>;
  [AuthorizationScope.Project]: Partial<Record<AuthorizationAction, ProjectActionConfig>>;
}

export const authorizationMatrix: AuthorizationMatrix = {
  [AuthorizationScope.Workspace]: {
    createUser: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
    listUsers: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN, WorkspaceRoleName.DEVELOPER],
    getUserById: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN, WorkspaceRoleName.DEVELOPER],
    updateUserRole: [WorkspaceRoleName.OWNER],
    createProject: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
    listProjects: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN, WorkspaceRoleName.DEVELOPER],
  },
  [AuthorizationScope.Project]: {
    getProjectById: {
      projectRoles: [
        ProjectRoleName.PROJECT_OWNER,
        ProjectRoleName.PROJECT_ADMIN,
        ProjectRoleName.DEVELOPER,
      ],
      workspaceBypass: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
    },
    addProjectMember: [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN],
    updateProjectRole: [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN],
    updateProject: {
      projectRoles: [ProjectRoleName.PROJECT_OWNER],
      workspaceBypass: [WorkspaceRoleName.OWNER],
    },
    deleteProject: {
      projectRoles: [ProjectRoleName.PROJECT_OWNER],
      workspaceBypass: [WorkspaceRoleName.OWNER],
    },
    createIssue: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
    assignIssue: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
    updateIssueStatus: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
    createSubtask: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
    assignSubtask: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
    updateSubtaskStatus: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
  },
};
