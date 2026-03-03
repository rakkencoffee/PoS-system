import { orderEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode('data: {"type":"CONNECTED"}\n\n'));

      // Subscribe to order events
      const unsubscribe = orderEvents.subscribe((data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream closed
          unsubscribe();
        }
      });

      // Keepalive every 30 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode('data: {"type":"KEEPALIVE"}\n\n'));
        } catch {
          clearInterval(keepalive);
          unsubscribe();
        }
      }, 30000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
