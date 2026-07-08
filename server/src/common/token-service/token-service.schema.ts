import { z } from 'zod';

export const TokenPayloadSchema = z.object({
  userId: z.string(),
  workspaceRoleId: z.string(),
  iat: z.number(),
  exp: z.number(),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

export const GenerateTokenPayloadSchema = TokenPayloadSchema.omit({ iat: true, exp: true });

export type GenerateTokenPayload = z.infer<typeof GenerateTokenPayloadSchema>;
