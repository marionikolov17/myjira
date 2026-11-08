import { z } from 'zod';
import { timestampSchema, userRefSchema } from './common';

export const commentSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  issueId: z.uuid(),
  creator: userRefSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Comment = z.infer<typeof commentSchema>;

export const COMMENT_BODY_MAX_LENGTH = 5000;

export const commentBody = z
  .string()
  .trim()
  .min(1, 'Comment is required')
  .max(COMMENT_BODY_MAX_LENGTH, `Comment must be ${COMMENT_BODY_MAX_LENGTH} characters or fewer`);

export const createCommentInputSchema = z.object({
  body: commentBody,
});
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;
