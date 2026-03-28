export function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}
