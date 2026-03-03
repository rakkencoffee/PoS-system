// Simple event emitter for SSE order updates

type Listener = (data: string) => void;

class OrderEventEmitter {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: string, data: unknown) {
    const message = JSON.stringify({ type: event, ...data as object });
    this.listeners.forEach((listener) => listener(message));
  }
}

// Global singleton
const globalForEvents = globalThis as unknown as {
  orderEvents: OrderEventEmitter | undefined;
};

export const orderEvents = globalForEvents.orderEvents ?? new OrderEventEmitter();

if (process.env.NODE_ENV !== 'production') globalForEvents.orderEvents = orderEvents;
