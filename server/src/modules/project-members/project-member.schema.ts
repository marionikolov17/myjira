import { z } from 'zod';

export enum ProjectRoleName {
  PROJECT_OWNER = 'ProjectOwner',
  PROJECT_ADMIN = 'ProjectAdmin',
  DEVELOPER = 'Developer',
}

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
