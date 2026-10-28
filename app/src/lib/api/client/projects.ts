import type { CreateProjectInput, ListQuery, UpdateProjectInput } from '@/lib/api/schemas'
import { transport } from '@/lib/api/transport'

export const projectsClient = {
  create: (input: CreateProjectInput) => transport.createProject(input),
  list: (query: ListQuery = {}) => transport.listProjects(query),
  getById: (id: string) => transport.getProjectById(id),
  update: (id: string, input: UpdateProjectInput) => transport.updateProject(id, input),
  remove: (id: string) => transport.deleteProject(id),
}
