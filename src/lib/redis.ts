import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

export const redis = Redis.fromEnv();

// Rate limiter untuk Olsera API (max 10 req/10 detik)
export const olseraRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  prefix: 'olsera',
});

// Rate limiter untuk API internal (max 50 req/menit per user)
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 m'),
  prefix: 'api',
});
