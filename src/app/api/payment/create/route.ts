import { NextRequest, NextResponse } from "next/server";
import { verifyOrderItems, computeVoucherDiscount, computeAutoPromoDiscount } from "@/lib/order-pricing";

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
 * `price`/`totalAmount`/`discountAmount` from the client are only used as a
 * hint of what the client thinks it's paying — the actual charge is always
 * recomputed server-side from the Olsera catalog (see @/lib/order-pricing),
 * never trusted as-is.
 *
 * Response: { simulated: true, orderId, orderNo, queueNumber }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customerName, customerPhone, voucherCode, paymentMethod, deviceId } =
      body;
    const isEdcCard = paymentMethod === "EDC_CARD";
    const isEdcQris = paymentMethod === "EDC_QRIS";

    if (!items || !items.length) {
      return NextResponse.json(
        { error: "Items are required" },
        { status: 400 },
      );
    }

    // SECURITY: never trust price/total/discount fields the client sends --
    // recompute every item's price from the live Olsera catalog (same one the
    // kiosk itself reads from) so the amount charged to the EDC terminal and
    // recorded in Olsera can't be manipulated by editing the checkout request.
    const priceCheck = await verifyOrderItems(items);
    if (!priceCheck.ok) {
      return NextResponse.json({ error: priceCheck.error }, { status: 400 });
    }

    // Voucher discount is likewise recomputed server-side (same rules
    // /api/payment/validate-voucher used for the "Apply" preview) rather than
    // trusted from the client's discountAmount -- packaging (bags) is not
    // discount-eligible, matching the checkout page's own totals.
    const nonBagItems = priceCheck.items.filter((i) => !i.isBag);
    const itemsSubtotal = nonBagItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    // `id` is the item's index in priceCheck.items/the original request
    // `items` array (NOT a re-index of this bag-filtered list) -- pos.adapter's
    // createOrder() receives that same array in that same order, so this id
    // is what lets it apply the per-item discount to the right Olsera line
    // item without re-deriving eligibility itself.
    const discountableItems = priceCheck.items
      .map((i, idx) => ({ i, idx }))
      .filter(({ i }) => !i.isBag)
      .map(({ i, idx }) => ({
        id: idx,
        category: i.categorySlug,
        name: i.name,
        price: i.unitPrice,
        quantity: i.quantity,
      }));

    const itemDiscounts: Record<string, number> = {};
    if (voucherCode) {
      const discountCheck = await computeVoucherDiscount(voucherCode, itemsSubtotal, discountableItems);
      if (!discountCheck.ok) {
        return NextResponse.json({ error: discountCheck.error }, { status: 400 });
      }
      Object.assign(itemDiscounts, discountCheck.itemDiscounts);
    }

    // Automatic date-gated promo (no code typed by the customer) -- runs on
    // every order regardless of voucherCode, see computeAutoPromoDiscount for
    // how its active window is controlled from Olsera.
    const autoPromo = await computeAutoPromoDiscount(discountableItems);
    if (autoPromo.active) {
      for (const [id, amount] of Object.entries(autoPromo.itemDiscounts)) {
        itemDiscounts[id] = (itemDiscounts[id] || 0) + amount;
      }
    }

    // Clamp each item's combined discount to its own line subtotal so a
    // manual voucher and the automatic promo can never stack past 100% off
    // the same item (e.g. both happening to target the same cheapest item).
    // itemDiscounts is mutated in place to the clamped values so it can be
    // passed to posAdapter.createOrder below for the Olsera line-item sync.
    let discountAmount = 0;
    for (const item of discountableItems) {
      const lineSubtotal = item.price * item.quantity;
      const combined = Math.min(itemDiscounts[String(item.id)] || 0, lineSubtotal);
      itemDiscounts[String(item.id)] = combined;
      discountAmount += combined;
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
        items.map((item: any, idx: number) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: priceCheck.items[idx].unitPrice,
          name: item.name,
          note: item.notes || item.note || "",
          options: item.options // Pass options for receipt formatting
        })),
        customerName,
        discountAmount,
        voucherCode,
        customerPhone,
        itemDiscounts
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
    // priceCheck.subtotal already covers every submitted item (drinks/food +
    // packaging); discountAmount was computed only against the non-bag
    // subtotal above, so subtracting it here still leaves packaging
    // un-discounted, matching the checkout page's own total math.
    const finalGrossAmount = Math.max(0, priceCheck.subtotal - discountAmount);

    // A 100%-off voucher (see order-pricing.ts's "free item" handling) can
    // bring the total to exactly Rp0 -- the physical EDC terminal can't
    // process a zero-amount Purchase/GenQRIS, so a fully-covered order skips
    // the EDC entirely and settles the same way a simulated payment does
    // below, regardless of which payment method the kiosk UI had selected.
    if ((isEdcCard || isEdcQris) && finalGrossAmount > 0) {
      // Payment goes through the physical EDC (see edc-bridge/) instead of
      // being auto-settled. The order stays PENDING/unpaid — the local
      // edc-bridge daemon polls /api/edc-jobs, pushes the amount to the
      // terminal (Purchase for card, GenQRIS for QRIS — see EdcJob.method),
      // and PATCHing the job APPROVED is what actually settles the order
      // (see /api/edc-jobs/[id] PATCH handler).
      const { prisma } = await import("@/lib/db");

      // EdcJob.orderId has a hard FK to Order.id. createOrder()'s own early
      // local-row insert (pos.adapter.ts) is best-effort and swallows its own
      // failure as "non-fatal, background sync will retry" -- under concurrent
      // load (e.g. two kiosk devices checking out at once) that insert can
      // transiently fail (DB connection contention), leaving no Order row for
      // this EdcJob to reference and crashing checkout with a foreign key
      // violation (confirmed live 2026-09-18). Upsert here as a self-healing
      // fallback: a no-op if createOrder()'s own insert already succeeded,
      // otherwise creates the same minimal placeholder row it would have.
      await prisma.order.upsert({
        where: { id: finalOrderId },
        update: {},
        create: {
          id: finalOrderId,
          stationId: "KIOSK",
          cashierId: "cmo83g6140000vq5g10u03858",
          queueNumber: dbQueueNumber || null,
          total: 0,
          status: "PENDING",
        },
      });

      const edcJob = await prisma.edcJob.create({
        data: {
          orderId: finalOrderId,
          amount: finalGrossAmount,
          status: "PENDING",
          deviceId: deviceId || null,
          method: isEdcQris ? "QRIS" : "CARD",
        },
      });

      return NextResponse.json({
        simulated: false,
        paymentMethod: isEdcQris ? "EDC_QRIS" : "EDC_CARD",
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
