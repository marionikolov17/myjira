import { ZodError } from 'zod';

import { ValidationError } from '@/common/errors';
import { IErrorField } from '@/common/errors/error.interface';
import { isPlainObject } from '@/common/utils/is-plain-object';
import { mapZodError } from '@/common/utils/map-zod-error';

import { paginationSchema } from './pagination.schema';
import { isSortableField, parseSortToken } from './sort.schema';
import { IQueryParser } from './query.interface';
import { DEFAULT_PAGE_SIZE } from './query.constants';
import {
  FilterFieldConfig,
  FilterOperator,
  QueryConfig,
  QueryFilter,
  QueryOptions,
  QueryPagination,
  QuerySort,
} from './query.types';

const FILTER_OPERATORS: readonly FilterOperator[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'];

export class QueryParser implements IQueryParser {
  public parse(rawQuery: unknown, config: QueryConfig): QueryOptions {
    const issues: IErrorField[] = [];
    const query: Record<string, unknown> = isPlainObject(rawQuery) ? rawQuery : {};

    const pagination = this.parsePagination(query, config, issues);
    const sort = this.parseSort(query, config, issues);
    const filters = this.parseFilters(query, config, issues);

    if (issues.length > 0) {
      throw new ValidationError(issues);
    }

    return { pagination, sort, filters };
  }

  private parsePagination(
    query: Record<string, unknown>,
    config: QueryConfig,
    issues: IErrorField[],
  ): QueryPagination {
    const schema = paginationSchema(config);

    const result = schema.safeParse({
      page: query['page'],
      pageSize: query['pageSize'],
    });

    if (!result.success) {
      this.appendZodIssues(result.error, issues);

      return {
        page: 1,
        pageSize: config.defaultPageSize ?? DEFAULT_PAGE_SIZE,
      };
    }

    return result.data;
  }

  private appendZodIssues(error: ZodError, issues: IErrorField[]): void {
    const mapped = mapZodError(error);

    for (const field of mapped.details?.fields ?? []) {
      issues.push({ name: field.name, message: field.message });
    }
  }

  private parseSort(
    query: Record<string, unknown>,
    config: QueryConfig,
    issues: IErrorField[],
  ): QuerySort[] {
    const raw = query['sort'];

    if (raw === undefined || raw === null || raw === '') {
      return [];
    }

    if (typeof raw !== 'string') {
      issues.push({ name: 'sort', message: 'sort must be a comma-separated string' });
      return [];
    }

    const result: QuerySort[] = [];

    for (const rawToken of raw.split(',')) {
      const parsed = parseSortToken(rawToken);

      if (parsed === null) {
        issues.push({ name: 'sort', message: 'sort token must not be empty' });
        continue;
      }

      if (!isSortableField(parsed.field, config.sortableFields)) {
        issues.push({
          name: 'sort',
          message: `Field "${parsed.field}" is not sortable`,
        });
        continue;
      }

      result.push({ field: parsed.field, direction: parsed.direction });
    }

    return result;
  }

  private parseFilters(
    query: Record<string, unknown>,
    config: QueryConfig,
    issues: IErrorField[],
  ): QueryFilter[] {
    const rawFilter = query['filter'];

    if (rawFilter === undefined) {
      return [];
    }

    if (!isPlainObject(rawFilter)) {
      issues.push({ name: 'filter', message: 'filter must be an object' });
      return [];
    }

    const result: QueryFilter[] = [];

    for (const [field, rawValue] of Object.entries(rawFilter)) {
      const fieldConfig = config.filterableFields[field];
      const fieldKey = `filter[${field}]`;

      if (!fieldConfig) {
        issues.push({ name: fieldKey, message: `Field "${field}" is not filterable` });
        continue;
      }

      if (isPlainObject(rawValue)) {
        this.parseOperatorFilters(field, fieldConfig, rawValue, issues, result);
      } else {
        this.parseDefaultFilter(field, fieldConfig, rawValue, fieldKey, issues, result);
      }
    }

    return result;
  }

  private parseOperatorFilters(
    field: string,
    fieldConfig: FilterFieldConfig,
    rawValue: Record<string, unknown>,
    issues: IErrorField[],
    result: QueryFilter[],
  ): void {
    for (const [op, opValue] of Object.entries(rawValue)) {
      const opKey = `filter[${field}][${op}]`;

      if (!this.isFilterOperator(op)) {
        issues.push({ name: opKey, message: `Operator "${op}" is not supported` });
        continue;
      }

      const operator: FilterOperator = op;

      if (!fieldConfig.operators.includes(operator)) {
        issues.push({
          name: opKey,
          message: `Operator "${operator}" is not permitted for field "${field}"`,
        });
        continue;
      }

      const coerced = this.coerceValue(opValue, operator, fieldConfig, opKey, issues);

      if (coerced !== undefined) {
        result.push({ field, operator, value: coerced });
      }
    }
  }

  private isFilterOperator(value: string): value is FilterOperator {
    return (FILTER_OPERATORS as readonly string[]).includes(value);
  }

  private parseDefaultFilter(
    field: string,
    fieldConfig: FilterFieldConfig,
    rawValue: unknown,
    fieldKey: string,
    issues: IErrorField[],
    result: QueryFilter[],
  ): void {
    const operator: FilterOperator = 'eq';

    if (!fieldConfig.operators.includes(operator)) {
      issues.push({
        name: fieldKey,
        message: `Operator "eq" is not permitted for field "${field}"`,
      });
      return;
    }

    const coerced = this.coerceValue(rawValue, operator, fieldConfig, fieldKey, issues);

    if (coerced !== undefined) {
      result.push({ field, operator, value: coerced });
    }
  }

  private coerceValue(
    value: unknown,
    operator: FilterOperator,
    fieldConfig: FilterFieldConfig,
    key: string,
    issues: IErrorField[],
  ): unknown {
    if (operator === 'in') {
      return this.coerceInValue(value, fieldConfig, key, issues);
    }

    const parsed = fieldConfig.schema.safeParse(value);

    if (!parsed.success) {
      this.appendZodIssuesUnder(parsed.error, key, issues);
      return undefined;
    }

    return parsed.data;
  }

  private coerceInValue(
    value: unknown,
    fieldConfig: FilterFieldConfig,
    key: string,
    issues: IErrorField[],
  ): unknown[] | undefined {
    if (typeof value !== 'string') {
      issues.push({ name: key, message: 'in operator expects a comma-separated string' });
      return undefined;
    }

    const parts = value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length === 0) {
      issues.push({ name: key, message: 'in operator requires at least one value' });
      return undefined;
    }

    const coerced: unknown[] = [];
    let hasError = false;

    for (const part of parts) {
      const parsed = fieldConfig.schema.safeParse(part);

      if (!parsed.success) {
        this.appendZodIssuesUnder(parsed.error, key, issues);
        hasError = true;
        continue;
      }

      coerced.push(parsed.data);
    }

    return hasError ? undefined : coerced;
  }

  private appendZodIssuesUnder(error: ZodError, name: string, issues: IErrorField[]): void {
    const mapped = mapZodError(error);
    const fields = mapped.details?.fields ?? [];

    if (fields.length === 0) {
      issues.push({ name, message: 'Invalid value' });
      return;
    }

    for (const field of fields) {
      issues.push({ name, message: field.message });
    }
  }
}
