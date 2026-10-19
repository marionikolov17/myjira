import { z } from 'zod';

export const ProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  creatorId: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectRequestParamsSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().min(1),
});
export type CreateProjectRequestParams = z.infer<typeof CreateProjectRequestParamsSchema>;

export const UpdateProjectRequestParamsSchema = z
  .strictObject({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'At least one of name or description must be provided',
  });
export type UpdateProjectRequestParams = z.infer<typeof UpdateProjectRequestParamsSchema>;
