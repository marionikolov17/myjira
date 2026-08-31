import { ActorContext } from '@/common/interfaces';

export enum AuthorizationScope {
  Workspace = 'workspace',
  Project = 'project',
}

export type AuthorizationAction =
  | 'createUser'
  | 'updateUserRole'
  | 'createProject'
  | 'addProjectMember'
  | 'updateProjectRole'
  | 'updateProject'
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
