/**
 * Queue Number Generator — Daily auto-incrementing queue numbers
 * 
 * Resets to 1 at 00:00 WIB (UTC+7) every day.
 * Uses atomic upsert on QueueCounter table to prevent race conditions.
 */

import { prisma } from '@/lib/db';

/**
 * Get today's date string in WIB (UTC+7) timezone.
 * Format: "2026-05-19"
 */
function getTodayWIB(): string {
  const now = new Date();
  // Convert to WIB: UTC + 7 hours
  const wibOffset = 7 * 60; // minutes
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const wibMinutes = utcMinutes + wibOffset;
  
  // Create a date object adjusted to WIB
  const wibDate = new Date(now);
  wibDate.setUTCMinutes(now.getUTCMinutes() + wibOffset);
  
  const year = wibDate.getUTCFullYear();
  const month = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wibDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Get the next queue number for today.
 * Atomically increments the counter for today's WIB date.
 * If no counter exists for today, creates one starting at 1.
 * 
 * @returns Queue number (1, 2, 3, ...) — format to "001" when displaying
 */
export async function getNextQueueNumber(): Promise<number> {
  const todayWIB = getTodayWIB();
  
  // Atomic upsert: create if not exists, increment if exists
  const result = await prisma.queueCounter.upsert({
    where: { date: todayWIB },
    update: { counter: { increment: 1 } },
    create: { date: todayWIB, counter: 1 },
  });
  
  console.log(`[Queue] Date=${todayWIB}, Queue=#${String(result.counter).padStart(3, '0')}`);
  return result.counter;
}

/**
 * Format queue number as 3-digit padded string.
 * 1 → "001", 42 → "042", 100 → "100"
 */
export function formatQueueNumber(num: number): string {
  return String(num).padStart(3, '0');
}
