import { Client, QueryResult, QueryResultRow } from 'pg';
import { IPgClient } from './pg-client.interface';

export class PgClient implements IPgClient {
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000;
  private isConnected = false;

  constructor(private readonly client: Client) {}

  public async query<T extends QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.client.query<T>(sql, params);
  }

  public async end(): Promise<void> {
    await this.client.end();
    this.isConnected = false;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        await this.connectToDatabase();
        return;
      } catch (error: unknown) {
        retries++;

        console.error(`
          Failed to connect to the database: ${(error as Error).message} \n
          Retrying in ${this.retryDelay}ms (attempt ${retries} of ${this.maxRetries})...
        `);

        await this.addRetryDelay();
      }
    }

    throw new Error('Failed to connect to the database');
  }

  private async connectToDatabase(): Promise<void> {
    await this.client.connect();
    this.isConnected = true;
    console.info('Connected to the database');
  }

  private async addRetryDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.retryDelay));
  }
}

export function createPgClient(): IPgClient {
  const connectionString = process.env['TEST_DATABASE_URL'];

  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL is not set');
  }

  return new PgClient(new Client({ connectionString }));
}
