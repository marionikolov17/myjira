import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  NULL_FILTER_VALUE,
  PROJECT_ROLE_IDS,
  addProjectMemberInputSchema,
  createIssueInputSchema,
  createProjectInputSchema,
  createUserInputSchema,
  loginInputSchema,
  projectRoleNameById,
  updateIssueInputSchema,
  updateProjectInputSchema,
  updateProjectMemberRoleInputSchema,
  updateUserRoleInputSchema,
  workspaceRoleNameById,
  type ActorContext,
  type Issue,
  type ListQuery,
  type Paginated,
  type Project,
  type ProjectMember,
  type User,
  type UserRef,
  type ValidationFieldError,
} from '@/lib/api/schemas'
import { actsWithProjectAdminLimits, can, ISSUE_MODIFY_DENIED_REASON, type Action } from '@/lib/authz/can'
import { commit, getDb, type DbIssue, type DbMember, type DbUser } from '@/lib/api/mocks/db'
import {
  assertUuid,
  authenticationRequired,
  businessRuleViolation,
  conflict,
  forbidden,
  invalidLoginCredentials,
  notFound,
  validate,
  validationError,
} from '@/lib/api/mocks/errors'
import { newId } from '@/lib/api/mocks/ids'
import { simulateLatency } from '@/lib/api/mocks/latency'
import { parseListQuery, serializeListQuery } from './queryString'
import type { Transport, TransportOptions } from './types'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const ACTIVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

type TokenPayload = { sub: string; iat: number; exp: number }

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
}

function issueToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_TTL_MS / 1000 }))
  return `${header}.${payload}.${base64UrlEncode(newId())}`
}

function readToken(token: string): TokenPayload | null {
  try {
    const [, payload] = token.split('.')
    const parsed = JSON.parse(base64UrlDecode(payload)) as TokenPayload
    return typeof parsed.sub === 'string' && typeof parsed.exp === 'number' ? parsed : null
  } catch {
    return null
  }
}

type FieldAccessor<T> = (item: T) => string | null

function applyListQuery<T>(
  items: T[],
  rawQuery: ListQuery,
  config: { sortable: Record<string, FieldAccessor<T>>; filterable: Record<string, FieldAccessor<T>>; defaultSort: string },
): Paginated<T> {
  // Round-trip through the wire format so the serializer is exercised exactly as the real server would see it.
  const query = parseListQuery(serializeListQuery(rawQuery))
  const fieldErrors: ValidationFieldError[] = []

  const page = query.page ?? 1
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
  if (!Number.isInteger(page) || page < 1) fieldErrors.push({ name: 'page', message: 'page must be a positive integer' })
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    fieldErrors.push({ name: 'pageSize', message: `pageSize must be between 1 and ${MAX_PAGE_SIZE}` })
  }
  for (const { field, op } of query.unknownOps) {
    fieldErrors.push({ name: `filter[${field}]`, message: `Unsupported filter operator "${op}"` })
  }

  let result = items
  for (const [field, ops] of Object.entries(query.filter ?? {})) {
    const accessor = config.filterable[field]
    if (!accessor) {
      fieldErrors.push({ name: `filter[${field}]`, message: `Filtering by "${field}" is not supported` })
      continue
    }
    for (const [op, expected] of Object.entries(ops)) {
      result = result.filter((item) => {
        const actual = accessor(item)
        const value = Array.isArray(expected) ? expected : [expected ?? '']
        // The literal "null" matches missing values for equality ops (e.g. unassigned issues).
        const equalsValue = (candidate: string) => (candidate === NULL_FILTER_VALUE ? actual === null : actual === candidate)
        switch (op) {
          case 'eq':
            return equalsValue(value[0])
          case 'ne':
            return !equalsValue(value[0])
          case 'in':
            return value.some(equalsValue)
          case 'gt':
            return actual !== null && actual > value[0]
          case 'gte':
            return actual !== null && actual >= value[0]
          case 'lt':
            return actual !== null && actual < value[0]
          case 'lte':
            return actual !== null && actual <= value[0]
          default:
            return true
        }
      })
    }
  }

  const sort = query.sort ?? config.defaultSort
  const descending = sort.startsWith('-')
  const sortField = descending ? sort.slice(1) : sort
  const sortAccessor = config.sortable[sortField]
  if (!sortAccessor) fieldErrors.push({ name: 'sort', message: `Sorting by "${sortField}" is not supported` })

  if (fieldErrors.length > 0) throw validationError(fieldErrors, 'The list query is invalid.')

  const sorted = [...result].sort((a, b) => {
    const left = sortAccessor(a) ?? ''
    const right = sortAccessor(b) ?? ''
    const order = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    return descending ? -order : order
  })

  const totalItems = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = (page - 1) * pageSize
  return {
    data: sorted.slice(start, start + pageSize),
    meta: { pagination: { pageNumber: page, pageSize, totalItems, totalPages } },
  }
}

const PRIORITY_RANK = { Low: '1', Medium: '2', High: '3' } as const
const STATUS_RANK = { ToDo: '1', InProgress: '2', Done: '3' } as const
const PROJECT_ROLE_RANK = { ProjectOwner: 0, ProjectAdmin: 1, Developer: 2 } as const

export function createMockTransport({ getToken }: TransportOptions): Transport {
  const db = () => getDb()

  async function run<T>(operation: () => T): Promise<T> {
    await simulateLatency()
    const result = operation()
    return result === undefined ? result : structuredClone(result)
  }

  function buildActor(userId: string, workspaceRoleId: string): ActorContext {
    const workspaceRoleName = workspaceRoleNameById(workspaceRoleId)
    if (!workspaceRoleName) throw authenticationRequired()
    return {
      userId,
      workspaceRole: { id: workspaceRoleId, name: workspaceRoleName },
      projectRoles: db()
        .members.filter((member) => member.userId === userId)
        .flatMap((member) => {
          const projectRoleName = projectRoleNameById(member.projectRoleId)
          return projectRoleName
            ? [{ projectId: member.projectId, projectRoleId: member.projectRoleId, projectRoleName }]
            : []
        }),
    }
  }

  function authenticate(): ActorContext {
    const token = getToken()
    if (!token) throw authenticationRequired()
    const payload = readToken(token)
    if (!payload || payload.exp * 1000 < Date.now()) throw authenticationRequired()
    const user = db().users.find((candidate) => candidate.id === payload.sub && candidate.status === 'Active')
    if (!user) throw authenticationRequired()
    return buildActor(user.id, user.workspaceRoleId)
  }

  function authorize(actor: ActorContext, action: Action, projectId?: string, message?: string): void {
    if (!can(actor, action, { projectId })) throw forbidden(message)
  }

  const toUser = ({ password: _password, ...user }: DbUser): User => user

  function toUserRef(userId: string): UserRef {
    const user = db().users.find((candidate) => candidate.id === userId)
    return user
      ? { id: user.id, name: user.name, email: user.email }
      : { id: userId, name: 'Unknown user', email: 'unknown@myjira.dev' }
  }

  function toMember(member: DbMember): ProjectMember {
    const roleName = projectRoleNameById(member.projectRoleId) ?? 'Developer'
    return {
      id: member.id,
      projectId: member.projectId,
      user: toUserRef(member.userId),
      projectRole: { id: member.projectRoleId, name: roleName },
    }
  }

  function toIssue(issue: DbIssue): Issue {
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      projectId: issue.projectId,
      creator: toUserRef(issue.creatorId),
      assignee: issue.assigneeId ? toUserRef(issue.assigneeId) : null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    }
  }

  function findUser(userId: string): DbUser {
    assertUuid('userId', userId)
    const user = db().users.find((candidate) => candidate.id === userId)
    if (!user) throw notFound('User', userId)
    return user
  }

  function findProject(projectId: string): Project {
    assertUuid('projectId', projectId)
    const project = db().projects.find((candidate) => candidate.id === projectId)
    if (!project) throw notFound('Project', projectId)
    return project
  }

  function findMember(projectId: string, memberId: string): DbMember {
    assertUuid('memberId', memberId)
    const member = db().members.find((candidate) => candidate.id === memberId && candidate.projectId === projectId)
    if (!member) throw notFound('ProjectMember', memberId)
    return member
  }

  function findIssue(projectId: string, issueId: string): DbIssue {
    assertUuid('issueId', issueId)
    const issue = db().issues.find((candidate) => candidate.id === issueId && candidate.projectId === projectId)
    if (!issue) throw notFound('Issue', issueId)
    return issue
  }

  function isProjectMember(projectId: string, userId: string): boolean {
    return db().members.some((member) => member.projectId === projectId && member.userId === userId)
  }

  function assertKnownProjectRole(projectRoleId: string): void {
    if (!projectRoleNameById(projectRoleId)) {
      throw validationError([{ name: 'projectRoleId', message: 'Unknown project role' }])
    }
  }

  const now = () => new Date().toISOString()

  return {
    login: (input) =>
      run(() => {
        const credentials = validate(loginInputSchema, input)
        const user = db().users.find(
          (candidate) => candidate.email.toLowerCase() === credentials.email.toLowerCase(),
        )
        if (!user || user.status !== 'Active' || user.password !== credentials.password) {
          throw invalidLoginCredentials()
        }
        return { data: { token: issueToken(user.id) } }
      }),

    getCurrentUser: () => run(() => ({ data: authenticate() })),

    createUser: (input) =>
      run(() => {
        const actor = authenticate()
        authorize(actor, 'users.create')
        const values = validate(createUserInputSchema, input)
        const roleName = workspaceRoleNameById(values.workspaceRoleId)
        if (!roleName) throw validationError([{ name: 'workspaceRoleId', message: 'Unknown workspace role' }])
        if (roleName === 'Owner') throw businessRuleViolation('Users cannot be invited with the Owner role.')
        if (db().users.some((user) => user.email.toLowerCase() === values.email.toLowerCase())) {
          throw conflict('A user with this email address already exists.')
        }
        const timestamp = now()
        const user: DbUser = {
          id: newId(),
          name: values.name,
          email: values.email.toLowerCase(),
          workspaceRoleId: values.workspaceRoleId,
          status: 'Pending',
          createdAt: timestamp,
          updatedAt: timestamp,
          password: null,
        }
        db().users.push(user)
        commit()
        const origin = typeof window === 'undefined' ? 'https://myjira.dev' : window.location.origin
        return {
          data: {
            user: toUser(user),
            activation: {
              url: `${origin}/activate?token=${newId()}`,
              expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS).toISOString(),
            },
          },
        }
      }),

    listUsers: (query) =>
      run(() => {
        const actor = authenticate()
        authorize(actor, 'users.list')
        const page = applyListQuery(db().users, query, {
          defaultSort: 'name',
          sortable: {
            name: (user) => user.name,
            email: (user) => user.email,
            createdAt: (user) => user.createdAt,
          },
          filterable: {
            status: (user) => user.status,
            workspaceRoleId: (user) => user.workspaceRoleId,
          },
        })
        return { ...page, data: page.data.map(toUser) }
      }),

    getUserById: (id) =>
      run(() => {
        const actor = authenticate()
        authorize(actor, 'users.getById')
        return { data: toUser(findUser(id)) }
      }),

    updateUserRole: (id, input) =>
      run(() => {
        const actor = authenticate()
        authorize(actor, 'users.updateRole')
        const target = findUser(id)
        const values = validate(updateUserRoleInputSchema, input)
        const nextRole = workspaceRoleNameById(values.workspaceRoleId)
        if (!nextRole) throw validationError([{ name: 'workspaceRoleId', message: 'Unknown workspace role' }])
        if (workspaceRoleNameById(target.workspaceRoleId) === 'Owner') {
          throw businessRuleViolation("The workspace Owner's role cannot be changed.")
        }
        if (nextRole === 'Owner') throw businessRuleViolation('The Owner role cannot be assigned.')
        target.workspaceRoleId = values.workspaceRoleId
        target.updatedAt = now()
        commit()
        return { data: toUser(target) }
      }),

    createProject: (input) =>
      run(() => {
        const actor = authenticate()
        authorize(actor, 'projects.create')
        const values = validate(createProjectInputSchema, input)
        const timestamp = now()
        const project: Project = {
          id: newId(),
          name: values.name,
          description: values.description,
          creatorId: actor.userId,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        db().projects.push(project)
        db().members.push({
          id: newId(),
          projectId: project.id,
          userId: actor.userId,
          projectRoleId: PROJECT_ROLE_IDS.ProjectOwner,
          createdAt: timestamp,
        })
        commit()
        return { data: project }
      }),

    listProjects: (query) =>
      run(() => {
        const actor = authenticate()
        authorize(actor, 'projects.list')
        const isWorkspaceManager =
          actor.workspaceRole.name === 'Owner' || actor.workspaceRole.name === 'Admin'
        const visible = isWorkspaceManager
          ? db().projects
          : db().projects.filter((project) => isProjectMember(project.id, actor.userId))
        return applyListQuery(visible, query, {
          defaultSort: 'name',
          sortable: {
            name: (project) => project.name,
            createdAt: (project) => project.createdAt,
            updatedAt: (project) => project.updatedAt,
          },
          filterable: { creatorId: (project) => project.creatorId },
        })
      }),

    getProjectById: (id) =>
      run(() => {
        const actor = authenticate()
        const project = findProject(id)
        authorize(actor, 'projects.getById', id)
        return { data: project }
      }),

    updateProject: (id, input) =>
      run(() => {
        const actor = authenticate()
        const project = findProject(id)
        authorize(actor, 'projects.update', id)
        const values = validate(updateProjectInputSchema, input)
        if (values.name !== undefined) project.name = values.name
        if (values.description !== undefined) project.description = values.description
        project.updatedAt = now()
        commit()
        return { data: project }
      }),

    deleteProject: (id) =>
      run(() => {
        const actor = authenticate()
        findProject(id)
        authorize(actor, 'projects.delete', id)
        const state = db()
        state.projects = state.projects.filter((project) => project.id !== id)
        state.members = state.members.filter((member) => member.projectId !== id)
        state.issues = state.issues.filter((issue) => issue.projectId !== id)
        commit()
      }),

    addProjectMember: (projectId, input) =>
      run(() => {
        const actor = authenticate()
        findProject(projectId)
        authorize(actor, 'members.add', projectId)
        const values = validate(addProjectMemberInputSchema, input)
        assertKnownProjectRole(values.projectRoleId)
        findUser(values.userId)
        if (values.projectRoleId === PROJECT_ROLE_IDS.ProjectOwner) {
          throw businessRuleViolation('The Project Owner role cannot be assigned.')
        }
        if (actsWithProjectAdminLimits(actor, projectId) && values.projectRoleId !== PROJECT_ROLE_IDS.Developer) {
          throw businessRuleViolation('A Project Admin may only add members with the Developer role.')
        }
        if (isProjectMember(projectId, values.userId)) throw conflict('This user is already a member of the project.')
        const member: DbMember = {
          id: newId(),
          projectId,
          userId: values.userId,
          projectRoleId: values.projectRoleId,
          createdAt: now(),
        }
        db().members.push(member)
        commit()
        return { data: toMember(member) }
      }),

    listProjectMembers: (projectId) =>
      run(() => {
        const actor = authenticate()
        findProject(projectId)
        authorize(actor, 'members.list', projectId)
        const members = db()
          .members.filter((member) => member.projectId === projectId)
          .map(toMember)
          .sort(
            (a, b) =>
              PROJECT_ROLE_RANK[a.projectRole.name] - PROJECT_ROLE_RANK[b.projectRole.name] ||
              a.user.name.localeCompare(b.user.name),
          )
        return { data: members }
      }),

    updateProjectMemberRole: (projectId, memberId, input) =>
      run(() => {
        const actor = authenticate()
        findProject(projectId)
        authorize(actor, 'members.updateRole', projectId)
        const member = findMember(projectId, memberId)
        const values = validate(updateProjectMemberRoleInputSchema, input)
        assertKnownProjectRole(values.projectRoleId)
        if (member.projectRoleId === PROJECT_ROLE_IDS.ProjectOwner) {
          throw businessRuleViolation("The Project Owner's role cannot be changed.")
        }
        if (member.userId === actor.userId) throw businessRuleViolation('You cannot change your own project role.')
        if (values.projectRoleId === PROJECT_ROLE_IDS.ProjectOwner) {
          throw businessRuleViolation('The Project Owner role cannot be assigned.')
        }
        member.projectRoleId = values.projectRoleId
        commit()
        return { data: toMember(member) }
      }),

    removeProjectMember: (projectId, memberId) =>
      run(() => {
        const actor = authenticate()
        findProject(projectId)
        authorize(actor, 'members.remove', projectId)
        const member = findMember(projectId, memberId)
        if (member.projectRoleId === PROJECT_ROLE_IDS.ProjectOwner) {
          throw businessRuleViolation('The Project Owner cannot be removed.')
        }
        if (member.userId === actor.userId) throw businessRuleViolation('You cannot remove yourself from a project.')
        if (actsWithProjectAdminLimits(actor, projectId) && member.projectRoleId !== PROJECT_ROLE_IDS.Developer) {
          throw businessRuleViolation('A Project Admin may only remove members with the Developer role.')
        }
        const state = db()
        state.members = state.members.filter((candidate) => candidate.id !== memberId)
        commit()
      }),

    createIssue: (projectId, input) =>
      run(() => {
        const actor = authenticate()
        findProject(projectId)
        authorize(actor, 'issues.create', projectId, ISSUE_MODIFY_DENIED_REASON)
        const values = validate(createIssueInputSchema, input)
        if (values.assigneeId && !isProjectMember(projectId, values.assigneeId)) {
          throw businessRuleViolation('The assignee must be a current member of this project.')
        }
        const timestamp = now()
        const issue: DbIssue = {
          id: newId(),
          title: values.title,
          description: values.description ?? '',
          status: values.status ?? 'ToDo',
          priority: values.priority ?? 'Medium',
          projectId,
          creatorId: actor.userId,
          assigneeId: values.assigneeId ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        db().issues.push(issue)
        commit()
        return { data: toIssue(issue) }
      }),

    listIssues: (projectId, query) =>
      run(() => {
        const actor = authenticate()
        findProject(projectId)
        authorize(actor, 'issues.list', projectId)
        const page = applyListQuery(
          db().issues.filter((issue) => issue.projectId === projectId),
          query,
          {
            defaultSort: '-updatedAt',
            sortable: {
              title: (issue) => issue.title,
              createdAt: (issue) => issue.createdAt,
              updatedAt: (issue) => issue.updatedAt,
              status: (issue) => STATUS_RANK[issue.status],
              priority: (issue) => PRIORITY_RANK[issue.priority],
            },
            filterable: {
              status: (issue) => issue.status,
              priority: (issue) => issue.priority,
              assigneeId: (issue) => issue.assigneeId,
              creatorId: (issue) => issue.creatorId,
            },
          },
        )
        return { ...page, data: page.data.map(toIssue) }
      }),

    getIssueById: (projectId, issueId) =>
      run(() => {
        const actor = authenticate()
        findProject(projectId)
        authorize(actor, 'issues.getById', projectId)
        return { data: toIssue(findIssue(projectId, issueId)) }
      }),

    updateIssue: (projectId, issueId, input) =>
      run(() => {
        const actor = authenticate()
        findProject(projectId)
        authorize(actor, 'issues.update', projectId, ISSUE_MODIFY_DENIED_REASON)
        const issue = findIssue(projectId, issueId)
        const values = validate(updateIssueInputSchema, input)
        if (
          values.assigneeId &&
          values.assigneeId !== issue.assigneeId &&
          !isProjectMember(projectId, values.assigneeId)
        ) {
          throw businessRuleViolation('The assignee must be a current member of this project.')
        }
        if (values.title !== undefined) issue.title = values.title
        if (values.description !== undefined) issue.description = values.description
        if (values.status !== undefined) issue.status = values.status
        if (values.priority !== undefined) issue.priority = values.priority
        if (values.assigneeId !== undefined) issue.assigneeId = values.assigneeId
        issue.updatedAt = now()
        commit()
        return { data: toIssue(issue) }
      }),

    deleteIssue: (projectId, issueId) =>
      run(() => {
        const actor = authenticate()
        findProject(projectId)
        authorize(actor, 'issues.delete', projectId, ISSUE_MODIFY_DENIED_REASON)
        findIssue(projectId, issueId)
        const state = db()
        state.issues = state.issues.filter((issue) => issue.id !== issueId)
        commit()
      }),
  }
}
