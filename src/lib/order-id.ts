import { redis } from './redis';

/**
 * POS Order ID Generator
 * 
 * Format: #[STATION_ID][SEQUENCE]
 * Example: #A001, #B001
 * 
 * Uses Redis atomic INCR to ensure no duplicates across multiple tablets.
 */

export async function generateOrderId(stationId: string = 'A'): Promise<string> {
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `order_seq:${stationId}:${dateStr}`;

  // Increment sequence for today at this station
  const seq = await redis.incr(key);

  // Set expiry to 48 hours to clean up old keys
  if (seq === 1) {
    await redis.expire(key, 172800);
  }

  // Format with leading zeros (e.g. 1 -> 001, 12 -> 012)
  const paddedSeq = String(seq).padStart(3, '0');

  return `#${stationId}${paddedSeq}`;
}
