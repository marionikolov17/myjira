import type {
  ActorContext,
  AddProjectMemberInput,
  Collection,
  CreateIssueInput,
  CreateProjectInput,
  CreateUserInput,
  CreateUserResponse,
  Envelope,
  Issue,
  ListQuery,
  LoginInput,
  LoginResponse,
  Paginated,
  Project,
  ProjectMember,
  ProjectRole,
  UpdateIssueInput,
  UpdateProjectInput,
  UpdateProjectMemberRoleInput,
  UpdateUserRoleInput,
  User,
  WorkspaceRole,
} from '@/lib/api/schemas';

export interface Transport {
  // auth
  login(input: LoginInput): Promise<Envelope<LoginResponse>>;

  // roles
  listWorkspaceRoles(): Promise<Collection<WorkspaceRole>>;
  listProjectRoles(): Promise<Collection<ProjectRole>>;

  // users
  getCurrentUser(): Promise<Envelope<ActorContext>>;
  createUser(input: CreateUserInput): Promise<Envelope<CreateUserResponse>>;
  listUsers(query: ListQuery): Promise<Paginated<User>>;
  getUserById(id: string): Promise<Envelope<User>>;
  updateUserRole(id: string, input: UpdateUserRoleInput): Promise<Envelope<User>>;

  // projects
  createProject(input: CreateProjectInput): Promise<Envelope<Project>>;
  listProjects(query: ListQuery): Promise<Paginated<Project>>;
  getProjectById(id: string): Promise<Envelope<Project>>;
  updateProject(id: string, input: UpdateProjectInput): Promise<Envelope<Project>>;
  deleteProject(id: string): Promise<void>;

  // members
  addProjectMember(
    projectId: string,
    input: AddProjectMemberInput,
  ): Promise<Envelope<ProjectMember>>;
  listProjectMembers(projectId: string): Promise<Collection<ProjectMember>>;
  updateProjectMemberRole(
    projectId: string,
    memberId: string,
    input: UpdateProjectMemberRoleInput,
  ): Promise<Envelope<ProjectMember>>;
  removeProjectMember(projectId: string, memberId: string): Promise<void>;

  // issues
  createIssue(projectId: string, input: CreateIssueInput): Promise<Envelope<Issue>>;
  listIssues(projectId: string, query: ListQuery): Promise<Paginated<Issue>>;
  getIssueById(projectId: string, issueId: string): Promise<Envelope<Issue>>;
  updateIssue(
    projectId: string,
    issueId: string,
    input: UpdateIssueInput,
  ): Promise<Envelope<Issue>>;
  deleteIssue(projectId: string, issueId: string): Promise<void>;
}

export type TransportOptions = {
  getToken: () => string | null;
};
