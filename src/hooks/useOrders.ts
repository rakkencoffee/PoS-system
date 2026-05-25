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
      // 1. Snapshot the previous cache value synchronously
      const previousOrders = queryClient.getQueryData<any[]>(['orders', 'kitchen']);

      // 2. Cancel outgoing queries in background (non-blocking)
      queryClient.cancelQueries({ queryKey: ['orders', 'kitchen'] }).catch(() => {});

      // 3. Optimistically update the cache synchronously!
      queryClient.setQueryData(['orders', 'kitchen'], (oldOrders: any[] | undefined) => {
        if (!oldOrders) return [];
        return oldOrders.map(order => {
          if (String(order.id) === String(orderId)) {
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

            return updated;
          }
          return order;
        });
      });

      return { previousOrders };
    },
    onError: (err, variables, context) => {
      // Rollback to previous snapshot if mutation fails
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders', 'kitchen'], context.previousOrders);
      }
    },
    onSuccess: (updatedOrder) => {
      // Apply the server-confirmed result
      queryClient.setQueryData(['orders', 'kitchen'], (oldOrders: any[] | undefined) => {
        if (!oldOrders) return [];
        return oldOrders.map(order => 
          String(order.id) === String(updatedOrder.id) ? { ...order, ...updatedOrder } : order
        );
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
