import { beforeAll, afterEach, afterAll } from '@jest/globals';
import { createPgClient } from '../lib/pg-client';
import { createTestSupabaseClient } from '../lib/supabase-client';
import { createSchemaManager, getTestSchema } from '../lib/schema-manager';

const pgClient = createPgClient();
const schema = getTestSchema();
const schemaManager = createSchemaManager(pgClient, schema);

beforeAll(async () => {
  await schemaManager.ensureSchema();

  const supabase = createTestSupabaseClient(schema);
  const probeTable = await schemaManager.getProbeTableName();

  await schemaManager.waitForReload(async () => {
    const { error } = await supabase.from(probeTable).select('*').limit(1);
    if (error) {
      throw error;
    }
  });
});

afterEach(async () => {
  await schemaManager.truncateSchema();
});

afterAll(async () => {
  await schemaManager.dropSchema();
  await pgClient.end();
});
