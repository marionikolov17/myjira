import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { ProjectRoleName } from '@/modules/project-roles';
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
    addProjectMember: {
      projectRoles: [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN],
      workspaceBypass: [WorkspaceRoleName.OWNER],
    },
    updateProjectMemberRole: {
      projectRoles: [ProjectRoleName.PROJECT_OWNER],
      workspaceBypass: [WorkspaceRoleName.OWNER],
    },
    removeProjectMember: {
      projectRoles: [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN],
      workspaceBypass: [WorkspaceRoleName.OWNER],
    },
    listProjectMembers: {
      projectRoles: [
        ProjectRoleName.PROJECT_OWNER,
        ProjectRoleName.PROJECT_ADMIN,
        ProjectRoleName.DEVELOPER,
      ],
      workspaceBypass: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
    },
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
