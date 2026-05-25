import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useKitchenOrders() {
  return useQuery({
    queryKey: ['orders', 'kitchen'],
    queryFn: async () => {
      const res = await fetch('/api/orders?today=true');
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      return Array.isArray(data) ? data.filter((o: any) => o.status !== 'COMPLETED') : [];
    },
    refetchInterval: 10000, // 10 detik polling backup
    refetchOnWindowFocus: false, // JANGAN refetch otomatis saat browser/window focus
    staleTime: 5000, // Anggap data fresh selama 5 detik
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ orderId, status, stationType }: { orderId: string | number; status: string; stationType?: string }) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, stationType }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || 'Failed to update order status');
      }
      return res.json();
    },
    onMutate: async ({ orderId, status, stationType }) => {
      console.log(`[onMutate] Triggered for orderId: ${orderId}, status: ${status}, stationType: ${stationType}`);
      
      // 1. Snapshot the previous cache value synchronously
      const previousOrders = queryClient.getQueryData<any[]>(['orders', 'kitchen']);
      console.log('[onMutate] Snapshot previousOrders count:', previousOrders?.length);

      // 2. Cancel outgoing queries in background (non-blocking)
      queryClient.cancelQueries({ queryKey: ['orders', 'kitchen'] }).catch(() => {});

      let matchFound = false;

      // 3. Optimistically update the cache synchronously!
      queryClient.setQueryData(['orders', 'kitchen'], (oldOrders: any[] | undefined) => {
        if (!oldOrders) return [];
        return oldOrders.map(order => {
          if (String(order.id) === String(orderId)) {
            matchFound = true;
            const updated = { ...order };
            if (stationType === 'barista') {
              updated.baristaStatus = status;
            } else if (stationType === 'kitchen') {
              updated.kitchenStatus = status;
            } else {
              updated.status = status;
            }

            // Combined status determination
            if (updated.baristaStatus === 'COMPLETED' && updated.kitchenStatus === 'COMPLETED') {
              updated.status = 'COMPLETED';
            } else if (
              updated.baristaStatus === 'PREPARING' || 
              updated.kitchenStatus === 'PREPARING' ||
              updated.baristaStatus === 'COMPLETED' || 
              updated.kitchenStatus === 'COMPLETED'
            ) {
              updated.status = 'PREPARING';
            }

            console.log('[onMutate] Found matching order in cache. Updated order detail:', updated);
            return updated;
          }
          return order;
        });
      });

      if (!matchFound) {
        console.warn(`[onMutate] WARNING: No matching order found in cache for ID: ${orderId}. Existing IDs:`, previousOrders?.map(o => o.id));
      }

      return { previousOrders };
    },
    onError: (err, variables, context) => {
      // Rollback to previous snapshot if mutation fails
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders', 'kitchen'], context.previousOrders);
      }
    },
    onSuccess: (updatedOrder) => {
      // Apply the server-confirmed result with status weight checks to prevent overwrites
      queryClient.setQueryData(['orders', 'kitchen'], (oldOrders: any[] | undefined) => {
        if (!oldOrders) return [];
        
        const STATUS_WEIGHTS: Record<string, number> = {
          'PENDING': 1,
          'PREPARING': 2,
          'COMPLETED': 3
        };

        return oldOrders.map(order => {
          if (String(order.id) === String(updatedOrder.id)) {
            const oldBaristaW = STATUS_WEIGHTS[order.baristaStatus] || 0;
            const oldKitchenW = STATUS_WEIGHTS[order.kitchenStatus] || 0;
            const oldStatusW = STATUS_WEIGHTS[order.status] || 0;

            const newBaristaW = STATUS_WEIGHTS[updatedOrder.baristaStatus] || 0;
            const newKitchenW = STATUS_WEIGHTS[updatedOrder.kitchenStatus] || 0;
            const newStatusW = STATUS_WEIGHTS[updatedOrder.status] || 0;

            const merged = { ...order, ...updatedOrder };
            
            // Prevent downgrading to an older status
            if (oldBaristaW > newBaristaW) {
              merged.baristaStatus = order.baristaStatus;
            }
            if (oldKitchenW > newKitchenW) {
              merged.kitchenStatus = order.kitchenStatus;
            }
            if (oldStatusW > newStatusW) {
              merged.status = order.status;
            }

            return merged;
          }
          return order;
        });
      });
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderData: any) => {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (!res.ok) throw new Error('Failed to create order');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useValidateVoucher() {
  return useMutation({
    mutationFn: async ({ code, totalAmount }: { code: string; totalAmount: number }) => {
      const res = await fetch('/api/payment/validate-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, totalAmount }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Invalid voucher');
      }
      return res.json();
    },
  });
}

export function usePaymentConfig() {
  return useQuery({
    queryKey: ['payment-config'],
    queryFn: async () => {
      const res = await fetch('/api/payment/config');
      if (!res.ok) throw new Error('Failed to fetch payment config');
      return res.json();
    },
    staleTime: Infinity,
  });
}
