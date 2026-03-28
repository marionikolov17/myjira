import { createPgClient } from '../lib/pg-client';
import { dropOrphanedSchemas } from '../lib/schema-manager';

export async function cleanupSchemas(): Promise<void> {
  const pgClient = createPgClient();

  try {
    await dropOrphanedSchemas(pgClient);
  } finally {
    await pgClient.end();
  }
}
