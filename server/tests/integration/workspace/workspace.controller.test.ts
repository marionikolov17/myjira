import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { prisma } from '@/common/lib/prisma';
import { workspaceController } from '@/modules/workspace';

const router = workspaceController.router;
const app = express();
app.use(express.json());
app.use(router);

describe('Workspace Controller', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  describe('POST /bootstrap', () => {
    it('should return 201 and create users', async () => {
      const response = await supertest(app).post('/bootstrap').send({
        bootstrapToken: 'test',
      });

      expect(response.status).toBe(201);
    });
  });
});
