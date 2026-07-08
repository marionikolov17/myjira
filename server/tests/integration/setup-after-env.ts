import { afterAll, afterEach, beforeAll, jest } from '@jest/globals';
import { prisma } from '@/common/lib/prisma';

// Each integration test file follows the same lifecycle:
//   1. Start from a clean database (beforeAll below).
//   2. Seed the data it needs in its own `beforeAll`.
//   3. Individual test cases may mutate that data.
//   4. The database is wiped again in `afterAll` so the next file starts clean.
async function resetDatabase() {
  await prisma.user.deleteMany();
  await prisma.workspaceRole.deleteMany();
}

beforeAll(async () => {
  await resetDatabase();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});
