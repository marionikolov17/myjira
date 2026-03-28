import { beforeAll, afterEach, afterAll } from '@jest/globals';
import { getTestSchema } from '../lib/schema-manager';
import { createSchemaManager, createPgClient } from '../lib';

const schema = getTestSchema();
const pgClient = createPgClient();
const schemaManager = createSchemaManager(pgClient);

const HOOK_TIMEOUT = 30_000;

beforeAll(async () => {
  await pgClient.connect();
  await schemaManager.recreateSchema(schema);
}, HOOK_TIMEOUT);

afterEach(async () => {
  await schemaManager.truncateSchema(schema);
}, HOOK_TIMEOUT);

afterAll(async () => {
  await schemaManager.dropSchema(schema);
  await pgClient.end();
}, HOOK_TIMEOUT);
