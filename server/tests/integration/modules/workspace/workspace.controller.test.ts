import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from './workspace.controller.setup';
import { env } from '@/config/env';

describe('WorkspaceController', () => {
  describe('/bootstrap', () => {
    it('should return 201 and the users when the bootstrap token is valid', async () => {
      const response = await request(app).post('/bootstrap').send({
        bootstrapToken: env.BOOTSTRAP_TOKEN,
      });

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual(expect.any(Array));
    });
  });
});
