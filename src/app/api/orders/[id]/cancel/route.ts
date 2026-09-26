import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ratelimit } from "@/lib/redis";

// The EDC DLL's COMStatus() often reports a failure for a payment the
// terminal actually approved (see edc-bridge/Pesan_Yokke_ResponseTimeout.txt),
// and a job still PROCESSING/APPROVED may have charged too. Voiding those
// orders loses paid orders, so they stay PENDING for an admin to settle or
// cancel from /admin/edc-monitor instead.
function mayHaveCharged(job: { status: string; errorMessage: string | null } | null) {
  if (!job) return false;
  if (job.status === "APPROVED" || job.status === "PROCESSING") return true;
  return job.status === "FAILED" && /COMStatus/i.test(job.errorMessage ?? "");
}

/**
 * POST /api/orders/[id]/cancel
 *
 * Called by the kiosk when a customer backs out of an in-progress EDC
 * payment ("Batalkan"). Marks the order CANCELLED locally and voids the
 * matching Olsera Open Order (best-effort) -- without this, an abandoned
 * checkout just sat as an unpaid order forever in both places.
 *
 * No login is involved in this flow (kiosk order IDs aren't secret and
 * there's no session to check ownership against), so this only rate-limits
 * by IP -- cancelOrder() itself already refuses to touch a PAID order, so
 * the real risk here was ever just griefing via ID enumeration, not fraud.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const { success } = await ratelimit.limit(`cancel-order:${ip}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = await params;

    const latestJob = await prisma.edcJob.findFirst({
      where: { orderId: id },
      orderBy: { createdAt: "desc" },
      select: { status: true, errorMessage: true },
    });
    if (mayHaveCharged(latestJob)) {
      console.warn(`[CancelOrder] Keeping ${id} PENDING -- EDC job ${latestJob?.status} (${latestJob?.errorMessage ?? "-"}) may have charged the customer.`);
      return NextResponse.json({ success: true, kept: true });
    }

    const posAdapter = await import("@/lib/integrations/pos.adapter");
    await posAdapter.cancelOrder(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CancelOrder] Failed to cancel order:", error);
    return NextResponse.json({ error: "Failed to cancel order" }, { status: 500 });
  }
}
