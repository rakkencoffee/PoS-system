'use client';

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/dexie';
import * as Sentry from "@sentry/nextjs";

export default function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Update online status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check for pending orders in Dexie
  const refreshPendingCount = useCallback(async () => {
    const count = await db.pendingOrders.count();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshPendingCount();
    // Also poll every 30 seconds as a fallback
    const interval = setInterval(refreshPendingCount, 30000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  // The actual sync logic
  const syncPendingOrders = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    const pending = await db.pendingOrders.where('status').equals('pending').toArray();
    const failed = await db.pendingOrders.where('status').equals('failed').toArray();
    const allToSync = [...pending, ...failed];

    if (allToSync.length === 0) return;

    console.log(`[OfflineSync] Starting sync for ${allToSync.length} orders...`);
    setIsSyncing(true);

    for (const order of allToSync) {
      try {
        if (!order.id) continue;
        
        // Update status to syncing in Dexie
        await db.pendingOrders.update(order.id, { status: 'syncing' });

        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order.items), // In our schema, we saved the full items payload
        });

        if (response.ok) {
          console.log(`[OfflineSync] Order ${order.orderId} synced successfully.`);
          await db.pendingOrders.delete(order.id);
        } else {
          throw new Error(`Server returned ${response.status}`);
        }
      } catch (error) {
        console.error(`[OfflineSync] Failed to sync order ${order.orderId}:`, error);
        if (order.id) {
          await db.pendingOrders.update(order.id, { status: 'failed' });
        }
        // Don't break the loop, try next one
      }
    }

    setIsSyncing(false);
    refreshPendingCount();
  }, [isOnline, isSyncing, refreshPendingCount]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncPendingOrders();
    }
  }, [isOnline, syncPendingOrders]);

  return (
    <>
      {children}
      {/* Global Sync Status Indicator (Minor UI) */}
      {(pendingCount > 0 || !isOnline) && (
        <div className="fixed bottom-24 left-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-bold uppercase tracking-wider animate-fade-in">
          {!isOnline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400">Offline Mode</span>
            </>
          ) : isSyncing ? (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-spin border-t-transparent border-2" />
              <span className="text-blue-400">Syncing {pendingCount} Orders...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-yellow-400">{pendingCount} Pending Sync</span>
            </>
          )}
        </div>
      )}
    </>
  );
}
