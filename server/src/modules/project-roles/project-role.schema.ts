import { z } from 'zod';

export enum ProjectRoleName {
  PROJECT_OWNER = 'ProjectOwner',
  PROJECT_ADMIN = 'ProjectAdmin',
  DEVELOPER = 'Developer',
}

export const ProjectRoleSchema = z.object({
  id: z.uuid(),
  name: z.enum(Object.values(ProjectRoleName)),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ProjectRole = z.infer<typeof ProjectRoleSchema>;
