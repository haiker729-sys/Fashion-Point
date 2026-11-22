import type { NextFunction, Request, Response } from 'express';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

interface BucketState {
  timestamps: number[];
}

/**
 * In-memory sliding-window rate limiter for sensitive administrative & financial endpoints.
 * Keys requests by caller IP + authorization token fingerprint (if present) so one client
 * cannot flood refunds, stock adjustments, order mutations, or CSV exports.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const buckets = new Map<string, BucketState>();
  const windowMs = Math.max(1000, config.windowMs);
  const maxRequests = Math.max(1, config.maxRequests);

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
    const ip = forwarded || req.ip || 'unknown';
    const authSuffix = String(req.headers.authorization || '').slice(-16);
    const key = `${config.keyPrefix}:${ip}:${authSuffix}`;

    const bucket = buckets.get(key) || { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

    if (bucket.timestamps.length >= maxRequests) {
      const oldest = bucket.timestamps[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: `Too many requests on ${config.keyPrefix}. Please retry in ${retryAfterSec}s.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSec,
      });
    }

    bucket.timestamps.push(now);
    buckets.set(key, bucket);

    // Lightweight periodic sweep to avoid unbounded memory growth
    if (buckets.size > 500) {
      for (const [k, b] of buckets.entries()) {
        if (b.timestamps.every((ts) => now - ts >= windowMs)) {
          buckets.delete(k);
        }
      }
    }

    next();
  };
}
