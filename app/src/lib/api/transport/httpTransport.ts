import { z } from 'zod';
import {
  ApiError,
  actorContextSchema,
  apiErrorBodySchema,
  collectionOf,
  commentSchema,
  createUserResponseSchema,
  envelopeOf,
  getApiErrorMessageFromCode,
  issueSchema,
  loginResponseSchema,
  paginatedOf,
  projectMemberSchema,
  projectRoleSchema,
  projectSchema,
  userSchema,
  workspaceRoleSchema,
  type ListQuery,
} from '@/lib/api/schemas';
import { serializeListQuery } from './queryString';
import type { Transport, TransportOptions } from './types';

type HttpTransportOptions = TransportOptions & { baseUrl: string };

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: ListQuery;
};

export function createHttpTransport({ baseUrl, getToken }: HttpTransportOptions): Transport {
  const trimmedBase = baseUrl.replace(/\/+$/, '');

  const buildPath = (path: string, query?: ListQuery): string => {
    const qs = query ? serializeListQuery(query) : '';
    return qs ? `${trimmedBase}${path}?${qs}` : `${trimmedBase}${path}`;
  };

  const buildHeaders = (token: string | null, body: unknown): Headers => {
    const headers = new Headers();

    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (isPlainObject(body)) headers.set('Content-Type', 'application/json');

    return headers;
  };

  async function execute(path: string, options: RequestOptions = {}): Promise<Response> {
    const { method = 'GET', body, query } = options;

    try {
      return await fetch(buildPath(path, query), {
        method,
        headers: buildHeaders(getToken(), body),
        body: isPlainObject(body) ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError({
        code: 'TRANSPORT_UNAVAILABLE',
        status: 0,
        message: getApiErrorMessageFromCode('TRANSPORT_UNAVAILABLE'),
      });
    }
  }

  async function requestRaw(path: string, options: RequestOptions = {}): Promise<unknown> {
    const response = await execute(path, options);
    const text = await response.text();
    const parsed = text ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      throw toApiError(response.status, parsed);
    }

    if (!isPlainObject(parsed)) {
      throw new ApiError({
        code: 'INTERNAL_SERVER_ERROR',
        status: response.status,
        message: 'The server returned an unexpected response.',
      });
    }
    return parsed;
  }

  async function request<T>(
    schema: z.ZodType<T>,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const parsed = await requestRaw(path, options);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new ApiError({
        code: 'INTERNAL_SERVER_ERROR',
        status: 500,
        message: 'The server returned an unexpected response.',
      });
    }
    return result.data;
  }

  async function requestVoid(path: string, options: RequestOptions = {}): Promise<void> {
    const response = await execute(path, options);
    if (response.status === 204) return;

    const text = await response.text();
    const parsed = text ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      throw toApiError(response.status, parsed);
    }

    throw new ApiError({
      code: 'INTERNAL_SERVER_ERROR',
      status: response.status,
      message: 'The server returned an unexpected response.',
    });
  }

  return {
    login: (input) =>
      request(envelopeOf(loginResponseSchema), '/auth/login', { method: 'POST', body: input }),

    listWorkspaceRoles: () => request(collectionOf(workspaceRoleSchema), '/workspace-roles'),
    listProjectRoles: () => request(collectionOf(projectRoleSchema), '/project-roles'),

    getCurrentUser: () => request(envelopeOf(actorContextSchema), '/users/me'),
    createUser: (input) =>
      request(envelopeOf(createUserResponseSchema), '/users', { method: 'POST', body: input }),
    listUsers: (query) => request(paginatedOf(userSchema), '/users', { query }),
    getUserById: (id) => request(envelopeOf(userSchema), `/users/${encodeURIComponent(id)}`),
    updateUserRole: (id, input) =>
      request(envelopeOf(userSchema), `/users/${encodeURIComponent(id)}/role`, {
        method: 'PATCH',
        body: input,
      }),

    createProject: (input) =>
      request(envelopeOf(projectSchema), '/projects', { method: 'POST', body: input }),
    listProjects: (query) => request(paginatedOf(projectSchema), '/projects', { query }),
    getProjectById: (id) =>
      request(envelopeOf(projectSchema), `/projects/${encodeURIComponent(id)}`),
    updateProject: (id, input) =>
      request(envelopeOf(projectSchema), `/projects/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: input,
      }),
    deleteProject: (id) => requestVoid(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    addProjectMember: (projectId, input) =>
      request(
        envelopeOf(projectMemberSchema),
        `/projects/${encodeURIComponent(projectId)}/members`,
        {
          method: 'POST',
          body: input,
        },
      ),
    listProjectMembers: (projectId) =>
      request(
        collectionOf(projectMemberSchema),
        `/projects/${encodeURIComponent(projectId)}/members`,
      ),
    updateProjectMemberRole: (projectId, memberId, input) =>
      request(
        envelopeOf(projectMemberSchema),
        `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
        { method: 'PATCH', body: input },
      ),
    removeProjectMember: (projectId, memberId) =>
      requestVoid(
        `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
        { method: 'DELETE' },
      ),

    createIssue: (projectId, input) =>
      request(envelopeOf(issueSchema), `/projects/${encodeURIComponent(projectId)}/issues`, {
        method: 'POST',
        body: input,
      }),
    listIssues: (projectId, query) =>
      request(paginatedOf(issueSchema), `/projects/${encodeURIComponent(projectId)}/issues`, {
        query,
      }),
    getIssueById: (projectId, issueId) =>
      request(
        envelopeOf(issueSchema),
        `/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}`,
      ),
    updateIssue: (projectId, issueId, input) =>
      request(
        envelopeOf(issueSchema),
        `/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}`,
        { method: 'PATCH', body: input },
      ),
    deleteIssue: (projectId, issueId) =>
      requestVoid(
        `/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}`,
        { method: 'DELETE' },
      ),

    listComments: (projectId, issueId) =>
      request(
        collectionOf(commentSchema),
        `/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments`,
      ),
    createComment: (projectId, issueId, input) =>
      request(
        envelopeOf(commentSchema),
        `/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments`,
        { method: 'POST', body: input },
      ),
    deleteComment: (projectId, issueId, commentId) =>
      requestVoid(
        `/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`,
        { method: 'DELETE' },
      ),
  };
}

function isPlainObject(value: unknown): value is object {
  return (
    value !== undefined && typeof value === 'object' && value !== null && !Array.isArray(value)
  );
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const parsed = apiErrorBodySchema.safeParse(body);
  if (parsed.success) {
    const payload = parsed.data.error;
    return new ApiError({
      ...payload,
      message: getApiErrorMessageFromCode(payload.code, payload.message),
    });
  }

  return new ApiError({
    code: 'INTERNAL_SERVER_ERROR',
    status,
    message: `The server responded with status ${status}.`,
  });
}
