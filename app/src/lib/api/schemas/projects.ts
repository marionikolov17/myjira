import { z } from 'zod';
import { timestampSchema } from './common';

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  creatorId: z.uuid(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Project = z.infer<typeof projectSchema>;

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, 'Project name is required')
  .max(100, 'Project name must be 100 characters or fewer');
const projectDescriptionSchema = z
  .string()
  .max(2000, 'Description must be 2000 characters or fewer');

export const createProjectInputSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
});
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

/** Partial PATCH body accepted by the API. */
export const updateProjectInputSchema = z.object({
  name: projectNameSchema.optional(),
  description: projectDescriptionSchema.optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

/**
 * Settings-form values for a full project update.
 * Both fields are required in the UI even though the API PATCH is partial.
 */
export const updateProjectFormSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
});
export type UpdateProjectFormValues = z.infer<typeof updateProjectFormSchema>;
