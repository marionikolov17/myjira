import { beforeEach, describe, expect, it } from '@jest/globals';
import { ZodError, ZodType } from 'zod';

import { ValidationError } from '@/common/errors';
import { ErrorCodes } from '@/common/errors/error-codes';
import { IErrorField } from '@/common/errors/error.interface';
import { IQueryParser, QueryConfig, QueryParser } from '@/common/query';

import {
  buildFlatFilter,
  buildInFilter,
  buildOperatorFilter,
  buildRawQuery,
  testQueryConfig,
} from './query.fixtures';

function expectValidationFields(fn: () => unknown): IErrorField[] {
  return expectValidationError(fn).details?.fields ?? [];
}

function expectValidationError(fn: () => unknown): ValidationError {
  let thrown: unknown;

  try {
    fn();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(ValidationError);
  return thrown as ValidationError;
}

describe('QueryParser', () => {
  let queryParser: IQueryParser;

  beforeEach(() => {
    queryParser = new QueryParser();
  });

  describe('parse - defaults', () => {
    it('should fall back to defaults when the raw query is not an object', () => {
      const result = queryParser.parse('not-an-object', testQueryConfig);

      expect(result).toEqual({
        pagination: { page: 1, pageSize: 10 },
        sort: [],
        filters: [],
      });
    });
  });

  describe('parse - pagination', () => {
    it('should default page to 1 and pageSize to the configured default when omitted', () => {
      const result = queryParser.parse(buildRawQuery(), testQueryConfig);

      expect(result.pagination).toEqual({ page: 1, pageSize: 10 });
    });

    it('should coerce numeric string inputs to integers', () => {
      const result = queryParser.parse(
        buildRawQuery({ page: '2', pageSize: '25' }),
        testQueryConfig,
      );

      expect(result.pagination).toEqual({ page: 2, pageSize: 25 });
    });

    it('should accept a pageSize equal to the max cap', () => {
      const result = queryParser.parse(buildRawQuery({ pageSize: '100' }), testQueryConfig);

      expect(result.pagination).toEqual({ page: 1, pageSize: 100 });
    });

    it.each([
      { case: 'zero page', input: { page: '0' }, field: 'page' },
      { case: 'negative page', input: { page: '-1' }, field: 'page' },
      { case: 'non-integer page', input: { page: '1.5' }, field: 'page' },
      { case: 'zero pageSize', input: { pageSize: '0' }, field: 'pageSize' },
      { case: 'negative pageSize', input: { pageSize: '-5' }, field: 'pageSize' },
      { case: 'non-integer pageSize', input: { pageSize: '2.5' }, field: 'pageSize' },
      { case: 'pageSize above the max cap', input: { pageSize: '101' }, field: 'pageSize' },
    ])('should reject $case naming the $field field', ({ input, field }) => {
      const fields = expectValidationFields(() =>
        queryParser.parse(buildRawQuery(input), testQueryConfig),
      );

      expect(fields.map((issue) => issue.name)).toContain(field);
    });
  });

  describe('parse - sort', () => {
    it('should return an empty sort list when sort is omitted', () => {
      const result = queryParser.parse(buildRawQuery(), testQueryConfig);

      expect(result.sort).toEqual([]);
    });

    it.each([
      { case: 'an empty string', value: '' },
      { case: 'null', value: null },
    ])('should return an empty sort list when sort is $case', ({ value }) => {
      const result = queryParser.parse({ sort: value }, testQueryConfig);

      expect(result.sort).toEqual([]);
    });

    it('should parse a single ascending field', () => {
      const result = queryParser.parse(buildRawQuery({ sort: 'createdAt' }), testQueryConfig);

      expect(result.sort).toEqual([{ field: 'createdAt', direction: 'asc' }]);
    });

    it('should interpret a leading "-" as descending', () => {
      const result = queryParser.parse(buildRawQuery({ sort: '-createdAt' }), testQueryConfig);

      expect(result.sort).toEqual([{ field: 'createdAt', direction: 'desc' }]);
    });

    it('should trim surrounding whitespace around a sort token', () => {
      const result = queryParser.parse(buildRawQuery({ sort: ' -createdAt ' }), testQueryConfig);

      expect(result.sort).toEqual([{ field: 'createdAt', direction: 'desc' }]);
    });

    it('should reject a bare "-" token with no field', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(buildRawQuery({ sort: '-' }), testQueryConfig),
      );

      expect(fields).toContainEqual({
        name: 'sort',
        message: 'sort token must not be empty',
      });
    });

    it('should preserve the order of multiple comma-separated fields', () => {
      const result = queryParser.parse(
        buildRawQuery({ sort: 'priority,-createdAt' }),
        testQueryConfig,
      );

      expect(result.sort).toEqual([
        { field: 'priority', direction: 'asc' },
        { field: 'createdAt', direction: 'desc' },
      ]);
    });

    it('should reject a field that is not declared sortable', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(buildRawQuery({ sort: 'unknownField' }), testQueryConfig),
      );

      expect(fields).toContainEqual({
        name: 'sort',
        message: 'Field "unknownField" is not sortable',
      });
    });

    // Wrong-type inputs bypass buildRawQuery, whose params are typed to the
    // valid request shape (sort as a string), and feed the parser a raw object.
    it('should reject a non-string sort value', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse({ sort: ['createdAt'] }, testQueryConfig),
      );

      expect(fields).toContainEqual({
        name: 'sort',
        message: 'sort must be a comma-separated string',
      });
    });

    it('should reject an empty sort token within a comma-separated list', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(buildRawQuery({ sort: 'createdAt,,priority' }), testQueryConfig),
      );

      expect(fields).toContainEqual({
        name: 'sort',
        message: 'sort token must not be empty',
      });
    });
  });

  describe('parse - filters', () => {
    it('should return an empty filter list when filter is omitted', () => {
      const result = queryParser.parse(buildRawQuery(), testQueryConfig);

      expect(result.filters).toEqual([]);
    });

    it('should default the operator to eq when no operator is given', () => {
      const result = queryParser.parse(
        buildRawQuery({ filter: buildFlatFilter('status', 'open') }),
        testQueryConfig,
      );

      expect(result.filters).toEqual([{ field: 'status', operator: 'eq', value: 'open' }]);
    });

    it('should honor an explicitly provided eq operator', () => {
      const result = queryParser.parse(
        buildRawQuery({ filter: buildOperatorFilter('status', 'eq', 'open') }),
        testQueryConfig,
      );

      expect(result.filters).toEqual([{ field: 'status', operator: 'eq', value: 'open' }]);
    });

    it('should emit one filter per operator when a field carries a range', () => {
      const result = queryParser.parse(
        buildRawQuery({
          filter: { createdAt: { gte: '2025-01-01T00:00:00Z', lte: '2025-12-31T00:00:00Z' } },
        }),
        testQueryConfig,
      );

      expect(result.filters).toEqual([
        { field: 'createdAt', operator: 'gte', value: new Date('2025-01-01T00:00:00Z') },
        { field: 'createdAt', operator: 'lte', value: new Date('2025-12-31T00:00:00Z') },
      ]);
    });

    it('should interpret explicit operators', () => {
      const result = queryParser.parse(
        buildRawQuery({
          filter: buildOperatorFilter('createdAt', 'gte', '2025-01-01T00:00:00Z'),
        }),
        testQueryConfig,
      );

      expect(result.filters).toEqual([
        {
          field: 'createdAt',
          operator: 'gte',
          value: new Date('2025-01-01T00:00:00Z'),
        },
      ]);
    });

    it('should coerce a numeric filter value to a number', () => {
      const result = queryParser.parse(
        buildRawQuery({ filter: buildOperatorFilter('assigneeCount', 'gt', '3') }),
        testQueryConfig,
      );

      expect(result.filters).toEqual([{ field: 'assigneeCount', operator: 'gt', value: 3 }]);
    });

    it('should split the in operator value on commas', () => {
      const result = queryParser.parse(
        buildRawQuery({ filter: buildInFilter('priority', ['high', 'medium']) }),
        testQueryConfig,
      );

      expect(result.filters).toEqual([
        { field: 'priority', operator: 'in', value: ['high', 'medium'] },
      ]);
    });

    it('should coerce each in-list member to the field type', () => {
      const result = queryParser.parse(
        buildRawQuery({ filter: buildInFilter('assigneeCount', ['1', '2']) }),
        testQueryConfig,
      );

      expect(result.filters).toEqual([{ field: 'assigneeCount', operator: 'in', value: [1, 2] }]);
    });

    it('should reject a field that is not declared filterable', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(
          buildRawQuery({ filter: buildFlatFilter('notAFilter', 'x') }),
          testQueryConfig,
        ),
      );

      expect(fields).toContainEqual({
        name: 'filter[notAFilter]',
        message: 'Field "notAFilter" is not filterable',
      });
    });

    it('should reject a filter that is not an object', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse({ filter: 'status' }, testQueryConfig),
      );

      expect(fields).toContainEqual({ name: 'filter', message: 'filter must be an object' });
    });

    it('should reject an operator that is not permitted for the field', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(
          buildRawQuery({ filter: buildOperatorFilter('status', 'gt', 'open') }),
          testQueryConfig,
        ),
      );

      expect(fields).toContainEqual({
        name: 'filter[status][gt]',
        message: 'Operator "gt" is not permitted for field "status"',
      });
    });

    it('should reject a value that cannot be coerced to the field type', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(
          buildRawQuery({ filter: buildOperatorFilter('assigneeCount', 'gt', 'not-a-number') }),
          testQueryConfig,
        ),
      );

      expect(fields.map((field) => field.name)).toContain('filter[assigneeCount][gt]');
    });

    it('should reject an unsupported operator on an otherwise filterable field', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(
          buildRawQuery({ filter: buildOperatorFilter('status', 'contains', 'open') }),
          testQueryConfig,
        ),
      );

      expect(fields).toContainEqual({
        name: 'filter[status][contains]',
        message: 'Operator "contains" is not supported',
      });
    });

    it('should reject a flat (default eq) filter on a field that does not permit eq', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(
          buildRawQuery({ filter: buildFlatFilter('createdAt', '2025-01-01T00:00:00Z') }),
          testQueryConfig,
        ),
      );

      expect(fields).toContainEqual({
        name: 'filter[createdAt]',
        message: 'Operator "eq" is not permitted for field "createdAt"',
      });
    });
  });

  describe('parse - in operator coercion', () => {
    it('should reject an in operator whose value is not a comma-separated string', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(buildRawQuery({ filter: { status: { in: ['high'] } } }), testQueryConfig),
      );

      expect(fields).toContainEqual({
        name: 'filter[status][in]',
        message: 'in operator expects a comma-separated string',
      });
    });

    it('should reject an in operator that resolves to no values after trimming', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(buildRawQuery({ filter: buildInFilter('status', []) }), testQueryConfig),
      );

      expect(fields).toContainEqual({
        name: 'filter[status][in]',
        message: 'in operator requires at least one value',
      });
    });

    it('should reject an in list when any member fails to coerce to the field type', () => {
      const fields = expectValidationFields(() =>
        queryParser.parse(
          buildRawQuery({ filter: buildInFilter('assigneeCount', ['1', 'not-a-number']) }),
          testQueryConfig,
        ),
      );

      expect(fields.map((field) => field.name)).toContain('filter[assigneeCount][in]');
    });
  });

  describe('parse - coercion error fallback', () => {
    it('should surface a generic message when the field schema reports no field-level issues', () => {
      const emptyErrorSchema = {
        safeParse: () => ({ success: false, error: new ZodError([]) }),
      } as unknown as ZodType;

      const config: QueryConfig = {
        sortableFields: [],
        filterableFields: {
          weird: { operators: ['eq'], schema: emptyErrorSchema },
        },
      };

      const fields = expectValidationFields(() =>
        queryParser.parse(buildRawQuery({ filter: buildFlatFilter('weird', 'x') }), config),
      );

      expect(fields).toContainEqual({ name: 'filter[weird]', message: 'Invalid value' });
    });
  });

  describe('parse - normalized options', () => {
    it('should return a QueryOptions carrying pagination, sort, and filters for a fully valid request', () => {
      const result = queryParser.parse(
        buildRawQuery({
          page: '2',
          pageSize: '25',
          sort: 'priority,-createdAt',
          filter: {
            status: 'open',
            createdAt: { gte: '2025-01-01T00:00:00Z' },
            priority: { in: 'high,medium' },
          },
        }),
        testQueryConfig,
      );

      expect(result).toEqual({
        pagination: { page: 2, pageSize: 25 },
        sort: [
          { field: 'priority', direction: 'asc' },
          { field: 'createdAt', direction: 'desc' },
        ],
        filters: expect.arrayContaining([
          { field: 'status', operator: 'eq', value: 'open' },
          { field: 'createdAt', operator: 'gte', value: new Date('2025-01-01T00:00:00Z') },
          { field: 'priority', operator: 'in', value: ['high', 'medium'] },
        ]),
      });
      expect(result.filters).toHaveLength(3);
    });
  });

  describe('parse - error accumulation', () => {
    it('should throw a single ValidationError naming every offending client-facing key', () => {
      const validationError = expectValidationError(() =>
        queryParser.parse(
          buildRawQuery({
            pageSize: '5000',
            sort: 'unknownField',
            filter: {
              status: '',
              createdAt: { gte: 'not-a-date' },
            },
          }),
          testQueryConfig,
        ),
      );

      expect(validationError.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(validationError.status).toBe(400);

      const fieldNames = (validationError.details?.fields ?? []).map((field) => field.name);
      expect(fieldNames).toEqual(
        expect.arrayContaining(['pageSize', 'sort', 'filter[status]', 'filter[createdAt][gte]']),
      );
    });
  });
});
