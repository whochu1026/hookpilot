import {
  computeBackoffMs,
  generateApiKey,
  safeEqual,
  sha256,
  signPayload,
} from './crypto.util';

describe('crypto.util', () => {
  it('hashes deterministically', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abd'));
  });

  it('generates unique api keys with prefix', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw.startsWith('hp_')).toBe(true);
    expect(a.prefix).toBe(a.raw.slice(0, 10));
    expect(a.hash).toBe(sha256(a.raw));
    expect(a.raw).not.toBe(b.raw);
  });

  it('signs with HMAC-SHA256', () => {
    const sig = signPayload('secret', '123', '{"ok":true}');
    expect(sig).toHaveLength(64);
    expect(signPayload('secret', '123', '{"ok":true}')).toBe(sig);
    expect(signPayload('other', '123', '{"ok":true}')).not.toBe(sig);
  });

  it('computes exponential backoff', () => {
    expect(computeBackoffMs(1, 10)).toBe(10_000);
    expect(computeBackoffMs(2, 10)).toBe(20_000);
    expect(computeBackoffMs(3, 10)).toBe(40_000);
    expect(computeBackoffMs(10, 10, 60)).toBe(60_000);
  });

  it('compares safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});
