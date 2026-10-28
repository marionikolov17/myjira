import { z } from 'zod'
import { timestampSchema } from './common'

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  creatorId: z.uuid(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
export type Project = z.infer<typeof projectSchema>

const projectName = z
  .string()
  .trim()
  .min(1, 'Project name is required')
  .max(100, 'Project name must be 100 characters or fewer')
const projectDescription = z.string().max(2000, 'Description must be 2000 characters or fewer')

export const createProjectInputSchema = z.object({
  name: projectName,
  description: projectDescription,
})
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>

export const updateProjectInputSchema = z.object({
  name: projectName.optional(),
  description: projectDescription.optional(),
})
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>
