import { z } from 'zod';

export const UserReferenceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
});
export type UserReference = z.infer<typeof UserReferenceSchema>;
