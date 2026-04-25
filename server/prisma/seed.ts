import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { ProjectRoleName, WorkspaceRoleName } from './generated/prisma/enums';

const WORKSPACE_ROLES: WorkspaceRoleName[] = [
  WorkspaceRoleName.Owner,
  WorkspaceRoleName.Admin,
  WorkspaceRoleName.Developer,
];

const PROJECT_ROLES: ProjectRoleName[] = [
  ProjectRoleName.ProjectOwner,
  ProjectRoleName.ProjectAdmin,
  ProjectRoleName.Developer,
];

const connectionString = `${process.env['DATABASE_URL']}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedWorkspaceRoles(): Promise<void> {
  const existing = await prisma.workspaceRole.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((role) => role.name));
  const missing = WORKSPACE_ROLES.filter((name) => !existingNames.has(name));

  if (missing.length === 0) {
    console.log('Workspace roles already seeded');
    return;
  }

  await prisma.workspaceRole.createMany({
    data: missing.map((name) => ({ name })),
  });

  console.log(`Seeded ${missing.length} workspace role(s): ${missing.join(', ')}`);
}

async function seedProjectRoles(): Promise<void> {
  const existing = await prisma.projectRole.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((role) => role.name));
  const missing = PROJECT_ROLES.filter((name) => !existingNames.has(name));

  if (missing.length === 0) {
    console.log('Project roles already seeded');
    return;
  }

  await prisma.projectRole.createMany({
    data: missing.map((name) => ({ name })),
  });

  console.log(`Seeded ${missing.length} project role(s): ${missing.join(', ')}`);
}

async function main(): Promise<void> {
  console.log('Starting database seed');

  await seedWorkspaceRoles();
  await seedProjectRoles();

  console.log('Database seed completed');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
