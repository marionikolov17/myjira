import type { IssuePriority, IssueStatus, Project, ProjectRoleName, WorkspaceRoleName } from '@/lib/api/schemas'
import type { DbIssue, DbMember, DbState, DbUser } from './db'
import { PROJECT_ROLE_IDS, WORKSPACE_ROLE_IDS, createRandom } from './ids'

export const DEMO_PASSWORD = 'password'

const DAY = 24 * 60 * 60 * 1000

type SeedUser = { key: string; name: string; role: WorkspaceRoleName }

const SEED_USERS: SeedUser[] = [
  { key: 'olivia', name: 'Olivia Carter', role: 'Owner' },
  { key: 'marcus', name: 'Marcus Lee', role: 'Admin' },
  { key: 'priya', name: 'Priya Nair', role: 'Admin' },
  { key: 'ethan', name: 'Ethan Brooks', role: 'Developer' },
  { key: 'sofia', name: 'Sofia Martinez', role: 'Developer' },
  { key: 'liam', name: 'Liam Chen', role: 'Developer' },
  { key: 'amara', name: 'Amara Okafor', role: 'Developer' },
  { key: 'noah', name: 'Noah Fischer', role: 'Developer' },
  { key: 'hana', name: 'Hana Sato', role: 'Developer' },
  { key: 'diego', name: 'Diego Alvarez', role: 'Developer' },
  { key: 'zoe', name: 'Zoe Williams', role: 'Developer' },
  { key: 'arjun', name: 'Arjun Patel', role: 'Developer' },
  { key: 'mia', name: 'Mia Kowalski', role: 'Developer' },
  { key: 'jonas', name: 'Jonas Berg', role: 'Developer' },
  { key: 'leila', name: 'Leila Haddad', role: 'Developer' },
]

type SeedProject = {
  name: string
  description: string
  owner: string
  members: Array<[string, Exclude<ProjectRoleName, 'ProjectOwner'>]>
  issueCount: number
  area: string
}

const SEED_PROJECTS: SeedProject[] = [
  {
    name: 'Atlas Platform',
    description: 'Core API, authentication service and shared infrastructure that every product team builds on.',
    owner: 'marcus',
    members: [
      ['ethan', 'ProjectAdmin'],
      ['sofia', 'Developer'],
      ['liam', 'Developer'],
      ['amara', 'Developer'],
      ['noah', 'Developer'],
    ],
    issueCount: 24,
    area: 'API',
  },
  {
    name: 'Nimbus Mobile',
    description: 'iOS and Android apps for field teams, including offline sync and push notifications.',
    owner: 'priya',
    members: [
      ['hana', 'ProjectAdmin'],
      ['sofia', 'ProjectAdmin'],
      ['diego', 'Developer'],
      ['zoe', 'Developer'],
      ['arjun', 'Developer'],
    ],
    issueCount: 19,
    area: 'Mobile',
  },
  {
    name: 'Helios Billing',
    description: 'Subscriptions, invoicing and usage metering for all paid plans.',
    owner: 'olivia',
    members: [
      ['marcus', 'ProjectAdmin'],
      ['ethan', 'Developer'],
      ['mia', 'Developer'],
      ['jonas', 'Developer'],
    ],
    issueCount: 27,
    area: 'Billing',
  },
  {
    name: 'Orion Design System',
    description: 'Shared component library, tokens and documentation site used across every web surface.',
    owner: 'priya',
    members: [
      ['leila', 'ProjectAdmin'],
      ['liam', 'Developer'],
      ['hana', 'Developer'],
      ['mia', 'Developer'],
      ['jonas', 'Developer'],
      ['diego', 'Developer'],
    ],
    issueCount: 16,
    area: 'UI',
  },
]

const ISSUE_TITLES = [
  'Add rate limiting to public endpoints',
  'Migrate session storage to Redis',
  'Fix flaky integration test for login flow',
  'Paginate audit log responses',
  'Improve error message for expired tokens',
  'Add dark mode support to settings',
  'Investigate memory leak in background worker',
  'Write runbook for on-call rotation',
  'Upgrade TypeScript to latest minor',
  'Remove deprecated v1 endpoints',
  'Add retry with backoff for webhook delivery',
  'Instrument slow database queries',
  'Localise date formatting for EU customers',
  'Cache permission lookups per request',
  'Add empty state to search results',
  'Support CSV export for reports',
  'Harden password reset flow',
  'Reduce bundle size of dashboard',
  'Add keyboard shortcuts for common actions',
  'Fix timezone bug in weekly digest',
  'Document environment variables',
  'Add health check endpoint',
  'Refactor notification preferences model',
  'Improve accessibility of modal dialogs',
  'Set up preview deployments for pull requests',
  'Add optimistic updates to comment list',
  'Handle offline mode gracefully',
  'Audit third-party dependencies',
  'Add skeleton loaders to list views',
  'Validate uploads on the server',
  'Consolidate duplicated date utilities',
  'Track feature adoption metrics',
  'Fix scroll jump when opening drawer',
  'Add bulk actions to table view',
  'Improve onboarding checklist copy',
]

const DESCRIPTION_TEMPLATES = [
  'Scope this for the {area} surface. Acceptance criteria: behaviour is covered by tests and documented in the changelog.',
  'Reported by several customers this sprint. Reproduce on staging first, then propose a fix in the {area} module.',
  'Follow-up from the last retro. Keep the change small and behind a flag if it touches the {area} critical path.',
  'Needs a short design review before implementation. Coordinate with the {area} owners on rollout.',
  '',
]

const STATUSES: IssueStatus[] = ['ToDo', 'ToDo', 'InProgress', 'InProgress', 'Done']
const PRIORITIES: IssuePriority[] = ['Low', 'Medium', 'Medium', 'High']

function emailFor(name: string, role?: WorkspaceRoleName): string {
  if (role === 'Owner') return 'owner@myjira.dev'
  return `${name.toLowerCase().replace(/\s+/g, '.')}@myjira.dev`
}

export function createSeed(): DbState {
  const random = createRandom(20260601)
  const now = Date.now()
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString()

  const users: DbUser[] = SEED_USERS.map((seed, index) => {
    const createdAt = iso((90 - index * 3) * DAY)
    return {
      id: random.uuid(),
      name: seed.name,
      email: emailFor(seed.name, seed.role),
      workspaceRoleId: WORKSPACE_ROLE_IDS[seed.role],
      status: 'Active',
      createdAt,
      updatedAt: createdAt,
      password: DEMO_PASSWORD,
    }
  })

  const pendingCreatedAt = iso(2 * DAY)
  users.push({
    id: random.uuid(),
    name: 'Rafael Costa',
    email: emailFor('Rafael Costa'),
    workspaceRoleId: WORKSPACE_ROLE_IDS.Developer,
    status: 'Pending',
    createdAt: pendingCreatedAt,
    updatedAt: pendingCreatedAt,
    password: null,
  })

  const userIdByKey = new Map(SEED_USERS.map((seed, index) => [seed.key, users[index].id]))
  const idOf = (key: string) => {
    const id = userIdByKey.get(key)
    if (!id) throw new Error(`Unknown seed user ${key}`)
    return id
  }

  const projects: Project[] = []
  const members: DbMember[] = []
  const issues: DbIssue[] = []

  SEED_PROJECTS.forEach((seed, projectIndex) => {
    const createdAt = iso((60 - projectIndex * 6) * DAY)
    const project: Project = {
      id: random.uuid(),
      name: seed.name,
      description: seed.description,
      creatorId: idOf(seed.owner),
      createdAt,
      updatedAt: createdAt,
    }
    projects.push(project)

    const roster: Array<[string, ProjectRoleName]> = [[seed.owner, 'ProjectOwner'], ...seed.members]
    const memberUserIds: string[] = []
    for (const [key, role] of roster) {
      const userId = idOf(key)
      memberUserIds.push(userId)
      members.push({
        id: random.uuid(),
        projectId: project.id,
        userId,
        projectRoleId: PROJECT_ROLE_IDS[role],
        createdAt,
      })
    }

    const titles = random.shuffle(ISSUE_TITLES).slice(0, seed.issueCount)
    for (const title of titles) {
      const ageMs = random.int(1, 42) * DAY + random.int(0, DAY)
      const issueCreatedAt = now - ageMs
      const issueUpdatedAt = issueCreatedAt + random.next() * (ageMs - 60_000)
      issues.push({
        id: random.uuid(),
        title,
        description: random.pick(DESCRIPTION_TEMPLATES).replaceAll('{area}', seed.area),
        status: random.pick(STATUSES),
        priority: random.pick(PRIORITIES),
        projectId: project.id,
        creatorId: random.pick(memberUserIds),
        assigneeId: random.next() < 0.12 ? null : random.pick(memberUserIds),
        createdAt: new Date(issueCreatedAt).toISOString(),
        updatedAt: new Date(issueUpdatedAt).toISOString(),
      })
    }
  })

  return { version: 1, users, projects, members, issues }
}

export const DEMO_ACCOUNTS = SEED_USERS.slice(0, 4).map((seed) => ({
  name: seed.name,
  email: emailFor(seed.name, seed.role),
  role: seed.role,
}))
