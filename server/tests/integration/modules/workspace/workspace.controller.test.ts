import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Application } from 'express';
import supertest from 'supertest';
import { prisma } from '@/common/lib/prisma';
import { workspaceController } from '@/modules/workspace';
import { createTestApp } from '@/common/utils/create-test-app';
import { env } from '@/config/env';

describe('Workspace Controller', () => {
  let app: Application;

  beforeAll(async () => {
    app = createTestApp(workspaceController.router);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /bootstrap', () => {
    beforeEach(async () => {
      await prisma.user.deleteMany();
    });

    it('should return 201 and create users', async () => {
      const response = await supertest(app).post('/bootstrap').send({
        bootstrapToken: env.BOOTSTRAP_TOKEN,
      });

      expect(response.status).toBe(201);
    });
  });
});
