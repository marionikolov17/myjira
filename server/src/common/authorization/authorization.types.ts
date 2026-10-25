import { ActorContext } from '@/common/interfaces';

export enum AuthorizationScope {
  Workspace = 'workspace',
  Project = 'project',
}

export type AuthorizationAction =
  | 'createUser'
  | 'listUsers'
  | 'getUserById'
  | 'updateUserRole'
  | 'createProject'
  | 'listProjects'
  | 'getProjectById'
  | 'addProjectMember'
  | 'updateProjectMemberRole'
  | 'removeProjectMember'
  | 'listProjectMembers'
  | 'updateProject'
  | 'deleteProject'
  | 'createIssue'
  | 'assignIssue'
  | 'updateIssueStatus'
  | 'createSubtask'
  | 'assignSubtask'
  | 'updateSubtaskStatus';

export type AuthorizeInput =
  | {
      actor: ActorContext;
      scope: AuthorizationScope.Workspace;
      action: AuthorizationAction;
    }
  | {
      actor: ActorContext;
      scope: AuthorizationScope.Project;
      action: AuthorizationAction;
      resource: string;
    };
