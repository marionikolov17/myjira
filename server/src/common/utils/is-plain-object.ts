/**
 * Narrows a value to a plain JSON object (`Record<string, unknown>`).
 *
 * Returns `false` for `null`, arrays, and primitives. This is useful for
 * normalizing request bodies before handing them to an object schema: a
 * non-object body can't be descended into, so a schema would otherwise emit a
 * single root-level type error instead of per-field errors.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
