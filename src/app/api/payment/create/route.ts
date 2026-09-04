import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/payment/create
 *
 * Creates the order in POS (Olsera) and immediately marks it as paid.
 * No real payment gateway is wired up yet — this is a simulated payment
 * standing in until one is (see docs/reference for the payment status).
 *
 * Body: {
 *   items: [{ productId, variantId?, quantity, name, price, note? }],
 *   totalAmount: number
 * }
 *
 * Response: { simulated: true, orderId, orderNo, queueNumber }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, totalAmount, customerName, customerPhone, discountAmount, voucherCode, station, paymentMethod } =
      body;
    const isEdcCard = paymentMethod === "EDC_CARD";

    if (!items || !items.length || typeof totalAmount !== "number") {
      return NextResponse.json(
        { error: "Items and totalAmount are required" },
        { status: 400 },
      );
    }

    // Generate unique order ID
    const orderId = `SF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 1. Create order in POS (Olsera) — NON-BLOCKING
    // Best Practice POS: Jangan pernah gagalkan pembayaran pelanggan karena API backend error.
    let dbOrderId: string | null = null;
    let dbOrderNo: string | null = null;
    let dbQueueNumber: number | null = null;
    let itemSyncPromise: Promise<void> | undefined;
    try {
      const posAdapter = await import("@/lib/integrations/pos.adapter");
      const adapterOrder = await posAdapter.createOrder(
        items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          note: item.notes || item.note || "",
          options: item.options // Pass options for receipt formatting
        })),
        customerName,
        discountAmount || 0,
        voucherCode,
        customerPhone,
        station
      );
      dbOrderId = adapterOrder.orderId;
      dbOrderNo = adapterOrder.orderNo || null;
      dbQueueNumber = adapterOrder.queueNumber || null;
      itemSyncPromise = adapterOrder.itemSyncPromise;
      console.log("Successfully created POS order:", dbOrderId, "orderNo:", dbOrderNo, "queue:", dbQueueNumber);

      // Inject discount natively to Olsera if a voucher was applied
      if (discountAmount && discountAmount > 0) {
        await posAdapter.applyOrderDiscount(dbOrderId, discountAmount);
      }
    } catch (posError) {
      // RESILIENT: Jika Olsera gagal, tetap lanjutkan pembayaran dengan order ID lokal.
      // Pesanan akan disinkronkan ke Olsera nanti via webhook atau manual reconciliation.
      console.error(
        "WARNING: Could not create POS order in Olsera (non-blocking):",
        posError,
      );
      dbOrderId = orderId; // Gunakan orderId lokal (SF-xxxx) sebagai fallback
    }

    const finalOrderId = dbOrderId ? String(dbOrderId) : orderId;
    const finalGrossAmount = Math.max(0, totalAmount - (discountAmount || 0));

    if (isEdcCard) {
      // Payment goes through the physical EDC (see edc-bridge/) instead of
      // being auto-settled. The order stays PENDING/unpaid — the local
      // edc-bridge daemon polls /api/edc-jobs, pushes the amount to the
      // terminal, and PATCHing the job APPROVED is what actually settles
      // the order (see /api/edc-jobs/[id] PATCH handler).
      const { prisma } = await import("@/lib/db");
      const edcJob = await prisma.edcJob.create({
        data: { orderId: finalOrderId, amount: finalGrossAmount, status: "PENDING" },
      });

      return NextResponse.json({
        simulated: false,
        paymentMethod: "EDC_CARD",
        orderId: finalOrderId,
        orderNo: dbOrderNo || '',
        queueNumber: dbQueueNumber || 0,
        edcJobId: edcJob.id,
      });
    }

    // Payment gateway isn't wired up yet — settle immediately as a simulated
    // payment. The local Prisma mirror row createOrder() writes in the
    // background may not exist yet, so defer to run after the response.
    const { after } = await import("next/server");
    after(async () => {
      // Wait for items (and any discount) to land on the Olsera order BEFORE
      // marking it paid — Olsera locks item edits the instant an order is
      // paid, so settling first races createOrder's background item sync:
      // best case a harmless 406 in the logs, worst case (an order with a
      // voucher) the discount silently never reaches Olsera's line items.
      if (itemSyncPromise) {
        try {
          await itemSyncPromise;
        } catch (syncWaitErr) {
          console.warn("Item sync promise rejected before settlement (proceeding anyway):", syncWaitErr);
        }
      }
      const posAdapter = await import("@/lib/integrations/pos.adapter");
      await posAdapter.updateOrderPaymentStatus(finalOrderId, "paid", finalGrossAmount, "system_simulated");
    });

    return NextResponse.json({
      simulated: true,
      orderId: finalOrderId,
      orderNo: dbOrderNo || '',
      queueNumber: dbQueueNumber || 0,
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create payment", details: errorMessage },
      { status: 500 },
    );
  }
}
