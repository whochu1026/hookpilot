import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `hp_${randomBytes(24).toString('hex')}`;
  return {
    raw,
    prefix: raw.slice(0, 10),
    hash: sha256(raw),
  };
}

export function generateEndpointSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

export function signPayload(secret: string, timestamp: string, body: string): string {
  const signedPayload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(signedPayload).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Exponential backoff: 2^attempt * baseSeconds (capped). */
export function computeBackoffMs(attempt: number, baseSeconds = 10, maxSeconds = 3600): number {
  const seconds = Math.min(baseSeconds * Math.pow(2, Math.max(0, attempt - 1)), maxSeconds);
  return seconds * 1000;
}
