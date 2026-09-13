import { QueryConfig, QueryOptions } from './query.types';

export interface IQueryParser {
  parse(rawQuery: unknown, config: QueryConfig): QueryOptions;
}
