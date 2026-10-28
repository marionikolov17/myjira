import type { CreateIssueInput, ListQuery, UpdateIssueInput } from '@/lib/api/schemas'
import { transport } from '@/lib/api/transport'

export const issuesClient = {
  create: (projectId: string, input: CreateIssueInput) => transport.createIssue(projectId, input),
  list: (projectId: string, query: ListQuery = {}) => transport.listIssues(projectId, query),
  getById: (projectId: string, issueId: string) => transport.getIssueById(projectId, issueId),
  update: (projectId: string, issueId: string, input: UpdateIssueInput) =>
    transport.updateIssue(projectId, issueId, input),
  remove: (projectId: string, issueId: string) => transport.deleteIssue(projectId, issueId),
}
