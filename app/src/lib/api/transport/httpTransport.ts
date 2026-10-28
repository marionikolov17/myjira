import { serializeListQuery } from './queryString';
import type { Transport, TransportOptions } from './types';

type HttpTransportOptions = TransportOptions & { baseUrl: string };

/**
 * Seam for the real backend. Each method documents the route it maps to; implement `request()`
 * with fetch + `Authorization: Bearer <token>` and translate error bodies via `ApiError.fromBody`.
 */
export function createHttpTransport({ baseUrl }: HttpTransportOptions): Transport {
  const notImplemented = (operation: string, route: string): never => {
    throw new Error(
      `httpTransport.${operation} is not implemented yet (${route} against ${baseUrl}).`,
    );
  };
  const withQuery = (path: string, query: Parameters<typeof serializeListQuery>[0]) => {
    const qs = serializeListQuery(query);
    return qs ? `${path}?${qs}` : path;
  };

  return {
    login: async () => notImplemented('login', 'POST /auth/login'),
    getCurrentUser: async () => notImplemented('getCurrentUser', 'GET /users/me'),
    createUser: async () => notImplemented('createUser', 'POST /users'),
    listUsers: async (query) => notImplemented('listUsers', `GET ${withQuery('/users', query)}`),
    getUserById: async (id) => notImplemented('getUserById', `GET /users/${id}`),
    updateUserRole: async (id) => notImplemented('updateUserRole', `PATCH /users/${id}/role`),
    createProject: async () => notImplemented('createProject', 'POST /projects'),
    listProjects: async (query) =>
      notImplemented('listProjects', `GET ${withQuery('/projects', query)}`),
    getProjectById: async (id) => notImplemented('getProjectById', `GET /projects/${id}`),
    updateProject: async (id) => notImplemented('updateProject', `PATCH /projects/${id}`),
    deleteProject: async (id) => notImplemented('deleteProject', `DELETE /projects/${id}`),
    addProjectMember: async (projectId) =>
      notImplemented('addProjectMember', `POST /projects/${projectId}/members`),
    listProjectMembers: async (projectId) =>
      notImplemented('listProjectMembers', `GET /projects/${projectId}/members`),
    updateProjectMemberRole: async (projectId, memberId) =>
      notImplemented(
        'updateProjectMemberRole',
        `PATCH /projects/${projectId}/members/${memberId}/role`,
      ),
    removeProjectMember: async (projectId, memberId) =>
      notImplemented('removeProjectMember', `DELETE /projects/${projectId}/members/${memberId}`),
    createIssue: async (projectId) =>
      notImplemented('createIssue', `POST /projects/${projectId}/issues`),
    listIssues: async (projectId, query) =>
      notImplemented('listIssues', `GET ${withQuery(`/projects/${projectId}/issues`, query)}`),
    getIssueById: async (projectId, issueId) =>
      notImplemented('getIssueById', `GET /projects/${projectId}/issues/${issueId}`),
    updateIssue: async (projectId, issueId) =>
      notImplemented('updateIssue', `PATCH /projects/${projectId}/issues/${issueId}`),
    deleteIssue: async (projectId, issueId) =>
      notImplemented('deleteIssue', `DELETE /projects/${projectId}/issues/${issueId}`),
  };
}
