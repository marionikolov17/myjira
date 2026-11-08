import { z } from 'zod';

import { UserReferenceSchema } from '@/common/schema';
import { ProjectRoleName } from '@/modules/project-roles';

export const ProjectMemberWithRoleSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  userId: z.uuid(),
  projectRoleId: z.uuid(),
  projectRole: z.object({
    id: z.uuid(),
    name: z.enum(Object.values(ProjectRoleName)),
  }),
});

export type ProjectMemberWithRole = z.infer<typeof ProjectMemberWithRoleSchema>;

export const ProjectMemberExpandedSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  user: UserReferenceSchema,
  projectRole: z.object({
    id: z.uuid(),
    name: z.enum(Object.values(ProjectRoleName)),
  }),
});

export type ProjectMemberExpanded = z.infer<typeof ProjectMemberExpandedSchema>;

export const AddProjectMemberRequestParamsSchema = z.strictObject({
  userId: z.uuid(),
  projectRoleId: z.uuid(),
});
export type AddProjectMemberRequestParams = z.infer<typeof AddProjectMemberRequestParamsSchema>;

export const UpdateProjectMemberRoleRequestParamsSchema = z.strictObject({
  projectRoleId: z.uuid(),
});
export type UpdateProjectMemberRoleRequestParams = z.infer<
  typeof UpdateProjectMemberRoleRequestParamsSchema
>;
