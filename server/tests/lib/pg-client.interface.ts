import { QueryResult, QueryResultRow } from 'pg';

export interface IPgClient {
  query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  end(): Promise<void>;
  connect(): Promise<void>;
}
