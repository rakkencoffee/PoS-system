import { pusherServer } from './pusher';

export const orderEvents = {
  /**
   * Emit an event via Pusher to the 'kitchen' channel.
   * Typical events: 'ORDER_CREATED', 'ORDER_UPDATED'
   */
  emit: async (event: string, data: any) => {
    try {
      // Broadcast non-blocking
      pusherServer.trigger('kitchen', event, data)
        .then(() => console.log(`[Pusher] Emitted ${event} to 'kitchen' channel`))
        .catch((err) => console.error(`[Pusher] Emit failed for ${event}:`, err));
    } catch (error) {
      console.error(`[Pusher] Unexpected error on emit for ${event}:`, error);
    }
  }
};
