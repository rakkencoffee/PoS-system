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
    refetchInterval: 60000, 
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string | number; status: string }) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update order status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
    mutationFn: async (code: string) => {
      const res = await fetch('/api/payment/validate-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Invalid voucher');
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
