import { getMigrationSql } from '../utils/migration-loader';
import { IPgClient } from './pg-client.interface';
import { quoteIdent } from '../utils/quote-ident';
import { ISchemaManager } from './schema-manager.interface';

const SCHEMA_PREFIX = 'test_';
export function getTestSchema(): string {
  return `${SCHEMA_PREFIX}${process.env['JEST_WORKER_ID'] ?? '0'}`;
}

export async function dropOrphanedSchemas(pgClient: IPgClient): Promise<void> {
  const result = await pgClient.query<{ schema_name: string }>(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE $1`,
    [`${SCHEMA_PREFIX}%`],
  );

  for (const row of result.rows) {
    try {
      await pgClient.query(`DROP SCHEMA IF EXISTS ${quoteIdent(row.schema_name)} CASCADE`);
    } catch (error) {
      console.error(
        `Failed to drop schema ${quoteIdent(row.schema_name)}: ${(error as Error).message}`,
      );
    }
  }
}

export class SchemaManager implements ISchemaManager {
  public readonly schema: string;

  constructor(
    private readonly pgClient: IPgClient,
    schema: string,
  ) {
    this.schema = schema;
  }

  public async ensureSchema(): Promise<void> {
    await this.pgClient.query(`DROP SCHEMA IF EXISTS ${quoteIdent(this.schema)} CASCADE`);
    await this.pgClient.query(`CREATE SCHEMA ${quoteIdent(this.schema)}`);

    const migrationSql = getMigrationSql(this.schema);
    await this.pgClient.query(migrationSql);

    await this.pgClient.query(`NOTIFY pgrst, 'reload schema'`);
  }

  public async getProbeTableName(): Promise<string> {
    const result = await this.pgClient.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = $1 LIMIT 1`,
      [this.schema],
    );

    const firstRow = result.rows[0];

    if (!firstRow) {
      throw new Error(`No tables found in schema ${quoteIdent(this.schema)}`);
    }

    return firstRow.tablename;
  }

  public async waitForReload(probe: () => Promise<void>, maxWaitMs = 5000): Promise<void> {
    const interval = 250;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      try {
        await probe();
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    throw new Error(
      `PostgREST did not reload schema ${quoteIdent(this.schema)} within ${maxWaitMs}ms`,
    );
  }

  public async truncateSchema(): Promise<void> {
    const result = await this.pgClient.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = $1`,
      [this.schema],
    );

    const tables = result.rows.map(
      (row) => `${quoteIdent(this.schema)}.${quoteIdent(row.tablename)}`,
    );

    if (tables.length > 0) {
      await this.pgClient.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
    }
  }

  public async dropSchema(): Promise<void> {
    await this.pgClient.query(`DROP SCHEMA IF EXISTS ${quoteIdent(this.schema)} CASCADE`);
  }
}

export function createSchemaManager(pgClient: IPgClient, schema: string): ISchemaManager {
  return new SchemaManager(pgClient, schema);
}
