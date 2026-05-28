import { NextRequest, NextResponse } from 'next/server';
import { olseraApi } from '@/lib/integrations/olsera.service';

function isNonCoffeeItem(category: string, name: string): boolean {
  const cat = String(category || '').toLowerCase().trim();
  const itemName = String(name || '').toLowerCase().trim();
  return (
    cat === 'non-coffee' || 
    cat === 'non coffee' ||
    cat === 'milk-based' ||
    cat === 'refreshment' ||
    itemName.includes('tea') ||
    itemName.includes('milk') ||
    itemName.includes('matcha') ||
    (itemName.includes('latte') && !itemName.includes('coffee') && !itemName.includes('espresso'))
  );
}

/**
 * POST /api/payment/validate-voucher
 * Body: { code: string, totalAmount: number, items: any[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { code, totalAmount, items } = await request.json();

    if (!code || typeof totalAmount !== 'number') {
      return NextResponse.json({ error: 'Kode dan totalAmount wajib diisi.' }, { status: 400 });
    }

    const uppercaseCode = code.toUpperCase().trim();
    // 1. Validate remote
    const result = await olseraApi.validateVoucherRemote(uppercaseCode, totalAmount);

    if (!result.valid) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // 2. Fetch voucher details to get rate/nominal details
    const voucher = await olseraApi.getVoucherByCode(uppercaseCode);
    if (!voucher) {
      return NextResponse.json({ error: 'Kode voucher tidak ditemukan.' }, { status: 400 });
    }

    const discountRate = parseFloat(voucher.discount_rate || '0');
    const discountNominal = parseFloat(voucher.discount_amount || '0');
    const isPercentage = voucher.discount_with === 2;

    let finalDiscountAmount = result.discountAmount;
    const itemDiscounts: Record<string, number> = {};

    // 3. Compute item-level discounts if items array is provided
    if (Array.isArray(items) && items.length > 0) {
      // Check if voucher restricts to Non-Coffee category
      const isRestrictedToNonCoffee = 
        uppercaseCode === 'RAKKEN002' || 
        String(voucher.title || '').toLowerCase().includes('non-coffee') ||
        String(voucher.title || '').toLowerCase().includes('non coffee');

      const eligibleItems = items.filter(item => {
        if (isRestrictedToNonCoffee) {
          return isNonCoffeeItem(item.category, item.name);
        }
        return true; // unrestricted voucher applies to all items
      });

      const eligibleTotal = eligibleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      if (eligibleItems.length > 0) {
        let remainingDiscount = 0;
        
        if (isPercentage) {
          // Calculate percentage discount per item
          eligibleItems.forEach(item => {
            const itemSubtotal = item.price * item.quantity;
            const itemDiscount = Math.floor(itemSubtotal * discountRate);
            itemDiscounts[item.id] = itemDiscount;
          });
          finalDiscountAmount = Object.values(itemDiscounts).reduce((sum, d) => sum + d, 0);
        } else {
          // Distribute nominal discount proportionally across eligible items
          remainingDiscount = Math.min(discountNominal, eligibleTotal);
          
          eligibleItems.forEach((item, idx) => {
            const itemSubtotal = item.price * item.quantity;
            let itemDiscount = 0;
            if (idx === eligibleItems.length - 1) {
              itemDiscount = remainingDiscount;
            } else {
              const share = itemSubtotal / eligibleTotal;
              itemDiscount = Math.round(Math.min(discountNominal, eligibleTotal) * share);
              remainingDiscount -= itemDiscount;
            }
            itemDiscounts[item.id] = itemDiscount;
          });
          finalDiscountAmount = Object.values(itemDiscounts).reduce((sum, d) => sum + d, 0);
        }
      } else {
        // No eligible items for this voucher
        if (isRestrictedToNonCoffee) {
          return NextResponse.json({ 
            error: 'Voucher ini hanya berlaku untuk kategori Non-Coffee saja.' 
          }, { status: 400 });
        }
        finalDiscountAmount = 0;
      }
    }

    return NextResponse.json({
      valid: true,
      message: result.message,
      discountAmount: finalDiscountAmount,
      itemDiscounts,
      code: uppercaseCode
    });

  } catch (error: any) {
    console.error('Error validating voucher:', error);
    return NextResponse.json({ 
      error: 'Gagal memvalidasi voucher', 
      details: error.message 
    }, { status: 500 });
  }
}
