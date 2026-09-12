const REDACTED = '[REDACTED]';

/**
 * Redacts the value of any `token` query parameter in a URL (or path+query)
 * string so single-use activation tokens are never written to logs.
 *
 * The rest of the URL is preserved verbatim; only the token value is replaced.
 */
export function redactTokenQueryParam(url: string): string {
  return url.replace(/([?&]token=)[^&#]*/gi, `$1${REDACTED}`);
}
