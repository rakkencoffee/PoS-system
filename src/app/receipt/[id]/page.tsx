'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  // Extract id directly using React.use for Promise
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const searchParams = useSearchParams();
  const queue = searchParams.get('queue') || '---';

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch order details to print
    fetch(`/api/orders/${id}`)
      .then(res => res.json())
      .then(data => {
        setOrder(data);
        setLoading(false);
        // Delay slightly giving time for font rendering before printing
        setTimeout(() => {
          if (typeof window !== 'undefined') window.print();
        }, 500);
      })
      .catch(err => {
        console.error('Failed to load receipt:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-4 text-center font-mono text-xs">Generating receipt...</div>;
  }

  if (!order) {
    return <div className="p-4 text-center font-mono text-xs text-red-500">Failed to load order data</div>;
  }

  const formatRupiah = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  return (
    <div className="bg-white text-black min-h-screen flex justify-center py-8 print:py-0 print:bg-transparent">
      {/* Container 80mm (approx 300px width) */}
      <div className="w-[300px] max-w-full bg-white px-4 py-6 font-mono text-xs border border-gray-200 shadow-xl print:shadow-none print:border-none print:p-0">
        
        {/* Header Section */}
        <div className="text-center mb-6">
          <h1 className="font-bold text-lg mb-1">RAKKEN COFFEE</h1>
          <p>Jl. Dr. Ir. H. Soekarno No. 48</p>
          <p>Surabaya, Jawa Timur</p>
          <p>Telp: 0811-3000-880</p>
          <div className="border-b border-black border-dashed mt-3"></div>
        </div>

        {/* Order Info */}
        <div className="mb-4">
          <div className="flex justify-between">
            <span>Kasir</span>
            <span>Kiosk - Self Service</span>
          </div>
          <div className="flex justify-between">
            <span>Tanggal</span>
            <span>{new Date(order.createdAt).toLocaleDateString('id-ID')}</span>
          </div>
          <div className="flex justify-between">
            <span>Waktu</span>
            <span>{new Date(order.createdAt).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}</span>
          </div>
          <div className="flex justify-between">
            <span>Order ID</span>
            <span>{order.id.replace('OLSERA-', '')}</span>
          </div>
        </div>
        
        {/* Big Queue Number */}
        <div className="text-center my-4 py-2 border-y border-black border-dotted">
          <p className="text-[10px] uppercase tracking-wider">Antrian</p>
          <p className="font-bold text-3xl my-1">#{queue}</p>
        </div>

        <div className="border-b border-black border-dashed mb-3"></div>

        {/* Items Section */}
        <div className="mb-4 space-y-2">
          {order.items?.map((item: any, index: number) => (
            <div key={index} className="flex flex-col">
              <div className="flex justify-between">
                <span className="font-bold">{item.menuItem?.name || 'Item'}</span>
                <span>{formatRupiah((item.subtotal || 0) / (item.quantity || 1))}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-700">
                <span>{item.quantity}x {item.size}</span>
                <span>{formatRupiah(item.subtotal || 0)}</span>
              </div>
              {/* Optional modifiers */}
              {(item.sugarLevel !== 'normal' || item.iceLevel !== 'normal' || item.notes) && (
                <div className="text-[10px] ml-2 text-gray-600">
                  {item.sugarLevel !== 'normal' && `S:${item.sugarLevel} `}
                  {item.iceLevel !== 'normal' && `I:${item.iceLevel} `}
                  {item.notes && `- ${item.notes}`}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-b border-black border-dashed mb-3"></div>

        {/* Totals Section */}
        <div className="mb-6">
          <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-black">
            <span>TOTAL PEMBAYARAN</span>
            <span>{formatRupiah(order.totalAmount)}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span>METODE PEMBAYARAN</span>
            <span className="uppercase">{order.paymentMethod || 'TUNAI'}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="font-bold">TERIMA KASIH</p>
          <p className="text-[10px] mt-1">Silakan ambil pesanan saat nomor Anda dipanggil.</p>
          
          <div className="mt-8 text-[9px] text-gray-400">
            Powered by StartFriday / Olsera API
          </div>
        </div>

        {/* Print Only Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page {
              margin: 0; 
              size: 80mm auto; /* Use standard 80mm thermal receipt sizing */
            }
            body {
              background: none;
              color: black;
            }
          }
        `}} />
      </div>
    </div>
  );
}
