import { NextRequest, NextResponse } from "next/server";
import { createSnapTransaction } from "@/lib/integrations/midtrans.service";

/**
 * POST /api/payment/create
 *
 * Creates a Midtrans Snap payment token for the given cart items.
 *
 * Body: {
 *   items: [{ productId, variantId?, quantity, name, price, note? }],
 *   totalAmount: number
 * }
 *
 * Response: { snapToken, orderId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, totalAmount, customerName, customerPhone, discountAmount, voucherCode, station, orderType } =
      body;

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
        station,
        orderType
      );
      dbOrderId = adapterOrder.orderId;
      dbOrderNo = adapterOrder.orderNo || null;
      dbQueueNumber = adapterOrder.queueNumber || null;
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

    // 2. Format Midtrans Items
    const midtransItems = items.map(
      (item: {
        productId: string;
        name: string;
        price: number;
        quantity: number;
      }) => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }),
    );

    // If discount exists, subtract it using Midtrans dummy item
    let finalGrossAmount = totalAmount;
    if (discountAmount && discountAmount > 0) {
      finalGrossAmount -= discountAmount;
      midtransItems.push({
        id: "VOUCHER",
        name: voucherCode ? `Voucher: ${voucherCode}` : "Discount Voucher",
        price: -Math.abs(discountAmount),
        quantity: 1,
      });
    }

    const finalOrderId = dbOrderId ? String(dbOrderId) : orderId;

    // Voucher discount fully covers the order — Midtrans rejects gross_amount <= 0,
    // so skip payment gateway entirely and mark the order paid directly.
    if (finalGrossAmount < 1) {
      // Defer to run after the response, same as createOrder's own background sync —
      // the local Prisma mirror row it depends on is written by that same background
      // step, so this can't run (or retry) synchronously within this request.
      const { after } = await import("next/server");
      after(async () => {
        const posAdapter = await import("@/lib/integrations/pos.adapter");
        await posAdapter.updateOrderPaymentStatus(finalOrderId, "paid", 0, "system_voucher_100");
      });

      return NextResponse.json({
        freeOrder: true,
        orderId: finalOrderId,
        orderNo: dbOrderNo || '',
        queueNumber: dbQueueNumber || 0,
      });
    }

    // 3. Create Midtrans Snap token
    const snapResult = await createSnapTransaction({
      orderId: finalOrderId,
      grossAmount: finalGrossAmount,
      items: midtransItems,
    });

    return NextResponse.json({
      snapToken: snapResult.token,
      redirectUrl: snapResult.redirect_url,
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
