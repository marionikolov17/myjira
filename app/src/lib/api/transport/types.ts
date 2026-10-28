import type {
  ActorContext,
  Collection,
  CreateIssueInput,
  Envelope,
  Issue,
  ListQuery,
  Paginated,
  Project,
  ProjectMember,
  UpdateIssueInput,
  User,
} from '@/lib/api/schemas';

export interface Transport {
  // auth
  login(input: { email: string; password: string }): Promise<Envelope<{ token: string }>>;
  // users
  getCurrentUser(): Promise<Envelope<ActorContext>>;
  createUser(input: {
    name: string;
    email: string;
    workspaceRoleId: string;
  }): Promise<Envelope<{ user: User; activation: { url: string; expiresAt: string } }>>;
  listUsers(query: ListQuery): Promise<Paginated<User>>;
  getUserById(id: string): Promise<Envelope<User>>;
  updateUserRole(id: string, input: { workspaceRoleId: string }): Promise<Envelope<User>>;
  // projects
  createProject(input: { name: string; description: string }): Promise<Envelope<Project>>;
  listProjects(query: ListQuery): Promise<Paginated<Project>>;
  getProjectById(id: string): Promise<Envelope<Project>>;
  updateProject(
    id: string,
    input: Partial<{ name: string; description: string }>,
  ): Promise<Envelope<Project>>;
  deleteProject(id: string): Promise<void>;
  // members
  addProjectMember(
    projectId: string,
    input: { userId: string; projectRoleId: string },
  ): Promise<Envelope<ProjectMember>>;
  listProjectMembers(projectId: string): Promise<Collection<ProjectMember>>;
  updateProjectMemberRole(
    projectId: string,
    memberId: string,
    input: { projectRoleId: string },
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
