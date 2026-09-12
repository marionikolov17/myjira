import { describe, expect, it } from '@jest/globals';

import { redactTokenQueryParam } from '@/common/utils/redact-token-query-param';

const RAW_TOKEN = 'super-secret-raw-activation-token';

describe('redactTokenQueryParam', () => {
  it('redacts a token query parameter value', () => {
    const result = redactTokenQueryParam(`/activate?token=${RAW_TOKEN}`);

    expect(result).toBe('/activate?token=[REDACTED]');
    expect(result).not.toContain(RAW_TOKEN);
  });

  it('redacts a token parameter that is not the first query parameter', () => {
    const result = redactTokenQueryParam(`/activate?foo=bar&token=${RAW_TOKEN}`);

    expect(result).toBe('/activate?foo=bar&token=[REDACTED]');
    expect(result).not.toContain(RAW_TOKEN);
  });

  it('preserves query parameters that follow the token', () => {
    const result = redactTokenQueryParam(`/activate?token=${RAW_TOKEN}&next=/home`);

    expect(result).toBe('/activate?token=[REDACTED]&next=/home');
    expect(result).not.toContain(RAW_TOKEN);
  });

  it('is case-insensitive on the token key', () => {
    const result = redactTokenQueryParam(`/activate?TOKEN=${RAW_TOKEN}`);

    expect(result).not.toContain(RAW_TOKEN);
  });

  it('leaves urls without a token parameter unchanged', () => {
    expect(redactTokenQueryParam('/api/v1/users')).toBe('/api/v1/users');
    expect(redactTokenQueryParam('/api/v1/users?page=2')).toBe('/api/v1/users?page=2');
  });

  it('does not redact unrelated params that merely contain "token" in their name', () => {
    const result = redactTokenQueryParam('/api?csrf_token_id=keep-me');

    expect(result).toBe('/api?csrf_token_id=keep-me');
  });
});
