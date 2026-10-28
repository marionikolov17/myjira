import type { IssuePriority, IssueStatus, Project, User } from '@/lib/api/schemas';
import { createSeed } from './fixtures';

export type DbUser = User & { password: string | null };

export type DbMember = {
  id: string;
  projectId: string;
  userId: string;
  projectRoleId: string;
  createdAt: string;
};

export type DbIssue = {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  projectId: string;
  creatorId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DbState = {
  version: 1;
  users: DbUser[];
  projects: Project[];
  members: DbMember[];
  issues: DbIssue[];
};

const STORAGE_KEY = 'myjira.mockdb.v1';

let state: DbState | null = null;

function load(): DbState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DbState;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function persist(): void {
  if (typeof window === 'undefined' || !state) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota or private mode: the in-memory DB keeps working for this session.
  }
}

export function getDb(): DbState {
  if (!state) {
    state = load() ?? createSeed();
    persist();
  }
  return state;
}

export function commit(): void {
  persist();
}

export function resetDb(): void {
  state = createSeed();
  persist();
}
