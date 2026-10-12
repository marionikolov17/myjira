import { z } from 'zod';

export const IdSchema = z.object({
  id: z.uuid(),
});
export type Id = z.infer<typeof IdSchema>;
