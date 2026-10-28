import { z } from 'zod'
import { userRefSchema } from './common'
import { projectRoleNameSchema } from './roles'

export const projectMemberSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  user: userRefSchema,
  projectRole: z.object({ id: z.uuid(), name: projectRoleNameSchema }),
})
export type ProjectMember = z.infer<typeof projectMemberSchema>

export const addProjectMemberInputSchema = z.object({
  userId: z.uuid('Select a user to add'),
  projectRoleId: z.uuid('Select a project role'),
})
export type AddProjectMemberInput = z.infer<typeof addProjectMemberInputSchema>

export const updateProjectMemberRoleInputSchema = z.object({
  projectRoleId: z.uuid('Select a project role'),
})
export type UpdateProjectMemberRoleInput = z.infer<typeof updateProjectMemberRoleInputSchema>
