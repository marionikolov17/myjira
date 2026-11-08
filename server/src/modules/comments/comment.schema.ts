import { z } from 'zod';

import { UserReferenceSchema } from '@/common/schema';

export const CommentSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  issueId: z.uuid(),
  creator: UserReferenceSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const CreateCommentRequestParamsSchema = z.strictObject({
  body: z
    .string()
    .min(1)
    .refine((value) => value.trim().length > 0, {
      message: 'body must not be blank',
    }),
});
export type CreateCommentRequestParams = z.infer<typeof CreateCommentRequestParamsSchema>;
