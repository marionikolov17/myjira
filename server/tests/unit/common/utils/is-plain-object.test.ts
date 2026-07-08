import { describe, expect, it } from '@jest/globals';
import { isPlainObject } from '@/common/utils/is-plain-object';

describe('isPlainObject', () => {
  it.each([
    { case: 'an empty object', value: {} },
    { case: 'a populated object', value: { email: 'test@example.com', password: 'secret' } },
    {
      case: 'an object with a null prototype',
      value: Object.create(null) as Record<string, unknown>,
    },
    { case: 'a nested object', value: { nested: { deep: true } } },
  ])('should return true when given $case', ({ value }) => {
    expect(isPlainObject(value)).toBe(true);
  });

  it.each([
    { case: 'null', value: null },
    { case: 'undefined', value: undefined },
    { case: 'an empty array', value: [] },
    { case: 'a populated array', value: [1, 2, 3] },
    { case: 'a string', value: 'a string' },
    { case: 'an empty string', value: '' },
    { case: 'a number', value: 123 },
    { case: 'zero', value: 0 },
    { case: 'a boolean', value: true },
  ])('should return false when given $case', ({ value }) => {
    expect(isPlainObject(value)).toBe(false);
  });

  it('should narrow the value to a Record so properties are accessible when given a plain object', () => {
    const value: unknown = { email: 'test@example.com' };

    if (isPlainObject(value)) {
      expect(value['email']).toBe('test@example.com');
    } else {
      throw new Error('Expected value to be narrowed to a plain object');
    }
  });
});
