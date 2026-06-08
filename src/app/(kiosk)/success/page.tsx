'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Receipt } from '@/components/pos/Receipt';
import { type PrintReceiptData } from '@/lib/print-bridge';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Handle both our router.push format AND Midtrans redirect format
  const orderId = searchParams.get('orderId') || searchParams.get('order_id');
  const transactionStatus = searchParams.get('transaction_status');
  
  // Extract queue: either from explicit param or from order ID (last 3 digits)
  const isOffline = searchParams.get('offline') === 'true';
  const rawQueue = searchParams.get('queue');
  const orderNo = searchParams.get('orderNo') || '';
  const queue = rawQueue || (() => {
    if (!orderId) return '123';
    
    const numericId = orderId.replace('OLSERA-', '').replace(/OFFLINE-/, '').replace(/[^0-9]/g, '');
    if (!numericId) return '123';
    
    return numericId.length > 3 ? numericId.slice(-3) : numericId;
  })();
  
  const [countdown, setCountdown] = useState(isOffline ? 30 : 15);
  const [orderData, setOrderData] = useState<any>(null);
  const [edcData, setEdcData] = useState<any>(null);
  const hasPrinted = useRef(false);
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'success' | 'fallback' | 'error'>('idle');

  // Auto-verify payment & Fetch order detail for receipt
  useEffect(() => {
    if (orderId && !isOffline) {
      console.log(`[Success] Starting order sync/fetch for ${orderId}...`);
      
      let retryCount = 0;
      const maxRetries = 8; // Increased retries
      
      const fetchOrder = async () => {
        try {
          const res = await fetch(`/api/orders/${orderId}?refresh=true`); // Added refresh hint
          const data = await res.json();
          
          if (data.id && data.items && data.items.length > 0) {
            console.log('[Success] Order data found with items:', data.id, 'orderNo:', data.orderNo);
            setOrderData(data);
          } else if (retryCount < maxRetries) {
            retryCount++;
            const delay = retryCount * 1000; // Exponential-ish backoff
            console.log(`[Success] Order items not ready yet, retrying in ${delay}ms... (${retryCount}/${maxRetries})`);
            setTimeout(fetchOrder, delay);
          } else {
            console.warn('[Success] Order data still incomplete after retries.');
            if (data.id) setOrderData(data);
          }
        } catch (e) {
          console.error('[Success] Fetch failed:', e);
        }
      };

      // Initial fetch
      fetchOrder();

      // Settlement logic
      if (process.env.NEXT_PUBLIC_TEST_MODE === 'true' || !transactionStatus) {
        // Force settlement in test mode or if direct visit
        fetch('/api/test-settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        }).catch(() => {});
      }
    }

    const isEdc = searchParams.get('edc') === 'true';
    if (isEdc) {
      setEdcData({
        approvalCode: searchParams.get('approval'),
        cardNo: searchParams.get('card'),
      });
    }
  }, [orderId, isOffline, searchParams, transactionStatus]);

  /**
   * Submit a print job to the Cloud Print Queue and poll for completion.
   */
  const submitCloudPrintJob = async (receiptData: PrintReceiptData) => {
    try {
      // 1. Create print job in the cloud database
      console.log('[CloudPrint] Submitting print job to /api/print-jobs...');
      const createRes = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptData),
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create print job: ${createRes.status}`);
      }

      const { jobId, status: initialStatus } = await createRes.json();
      console.log(`[CloudPrint] Job created: ${jobId}, status: ${initialStatus}`);

      if (initialStatus === 'PRINTED') {
        // Job was already printed (duplicate request)
        return 'success';
      }

      // 2. Poll for print completion (max 15 seconds)
      const maxPollTime = 15000;
      const pollInterval = 2000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxPollTime) {
        await new Promise(r => setTimeout(r, pollInterval));

        const statusRes = await fetch(`/api/print-jobs/status?orderId=${receiptData.orderId}`);
        if (!statusRes.ok) continue;

        const statusData = await statusRes.json();
        console.log(`[CloudPrint] Poll status: ${statusData.status}`);

        if (statusData.status === 'PRINTED') {
          return 'success';
        }
        if (statusData.status === 'FAILED' && statusData.attempts >= 3) {
          return 'error';
        }
      }

      // Timed out — the daemon might be offline
      console.warn('[CloudPrint] Polling timed out. Daemon may be offline.');
      return 'timeout';

    } catch (err) {
      console.error('[CloudPrint] Error:', err);
      return 'error';
    }
  };

  // Auto-print logic — uses Cloud Print Queue
  useEffect(() => {
    if (orderData && orderData.items?.length > 0 && !hasPrinted.current) {
      console.log('[Success] Order items detected, initiating cloud print...');
      
      const triggerPrint = async () => {
        if (hasPrinted.current) return;
        hasPrinted.current = true;
        setPrintStatus('printing');

        try {
          const displayOrderNo = (orderNo || orderData?.orderNo) || orderId || '';
          const receiptData: PrintReceiptData = {
            orderId: displayOrderNo,
            dbOrderId: orderId || undefined,
            queueNumber: queue,
            customerName: orderData.customerName || '',
            items: orderData.items || [],
            total: orderData.totalAmount || 0,
            discount: orderData.discount || 0,
            paymentMethod: edcData ? 'Debit/Credit' : (orderData.paymentMethod || 'E-Wallet'),
            edcData: edcData ? {
              approvalCode: edcData.approvalCode || '',
              cardNo: edcData.cardNo || '',
              refNo: orderId || ''
            } : undefined
          };

          const result = await submitCloudPrintJob(receiptData);

          if (result === 'success') {
            setPrintStatus('success');
          } else if (result === 'timeout') {
            // Daemon mungkin offline, fallback ke browser print
            console.warn('[Success] Cloud print timed out, falling back to browser print');
            if (typeof window !== 'undefined') window.print();
            setPrintStatus('fallback');
          } else {
            setPrintStatus('error');
            hasPrinted.current = false; // Allow retry
          }
        } catch (err) {
          console.error('[Success] Print error:', err);
          setPrintStatus('error');
          hasPrinted.current = false;
        }
      };

      const timer = setTimeout(triggerPrint, 300);
      return () => clearTimeout(timer);
    }
  }, [orderData, orderId, queue, edcData, orderNo]);

  const handlePrint = async () => {
    setPrintStatus('printing');
    try {
      const displayOrderNo = (orderNo || orderData?.orderNo) || orderId || '';
      const receiptData: PrintReceiptData = {
        orderId: displayOrderNo,
        dbOrderId: orderId || undefined,
        queueNumber: queue,
        customerName: orderData?.customerName || '',
        items: orderData?.items || [],
        total: orderData?.totalAmount || 0,
        discount: orderData?.discount || 0,
        paymentMethod: edcData ? 'Debit/Credit' : (orderData?.paymentMethod || 'E-Wallet'),
        edcData: edcData ? {
          approvalCode: edcData.approvalCode || '',
          cardNo: edcData.cardNo || '',
          refNo: orderId || ''
        } : undefined
      };

      const result = await submitCloudPrintJob(receiptData);
      if (result === 'success') {
        setPrintStatus('success');
      } else {
        window.print();
        setPrintStatus('fallback');
      }
    } catch {
      window.print();
      setPrintStatus('fallback');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      router.push('/');
    }
  }, [countdown, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        {/* Success Animation */}
        <div className="mb-8 animate-scale-in">
          <div className="relative inline-block">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto shadow-2xl ${
              isOffline 
                ? 'bg-linear-to-r from-amber-500 to-orange-500 shadow-amber-500/30' 
                : 'bg-linear-to-r from-green-500 to-emerald-500 shadow-green-500/30'
            }`}>
              <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOffline ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                )}
              </svg>
            </div>
            <div className={`absolute -inset-4 rounded-full blur-xl animate-pulse ${
              isOffline ? 'bg-amber-500/20' : 'bg-green-500/20'
            }`} />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-(--text-primary) mb-2 animate-fade-in-up">
          {isOffline ? 'Order Queued Offline' : 'Payment Successful!'}
        </h1>
        <p className="text-(--text-muted) mb-8 animate-fade-in delay-1 text-sm">
          {isOffline 
            ? 'We saved your order locally. It will be sent to the kitchen as soon as internet is restored.' 
            : 'Your order has been placed and sent to the kitchen.'}
        </p>

        {/* Queue & Order Number */}
        <div className="glass-card p-8 mb-8 animate-fade-in-up delay-2" style={{ opacity: 0 }}>
          <p className="text-sm text-(--text-muted) uppercase tracking-wider mb-2">Nomor Antrean</p>
          <div className="text-7xl font-black text-gradient mb-2">
            #{String(queue).padStart(3, '0')}
          </div>
          <div className="text-sm text-(--text-muted) mb-4 font-mono">
            ID: {(orderNo || orderData?.orderNo) || orderId}
          </div>
          <div className="flex items-center justify-center gap-2 text-(--text-secondary)">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">Estimated wait: 5-10 minutes</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="glass-card p-5 mb-8 text-left animate-fade-in delay-3" style={{ opacity: 0 }}>
          <h3 className="font-semibold text-(--text-primary) mb-3 text-center">What&apos;s Next?</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#A8131E] flex items-center justify-center text-xs text-white mt-0.5 shrink-0">1</span>
              <p className="text-sm text-(--text-secondary)">Wait for your number to be called</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#A8131E] flex items-center justify-center text-xs text-white mt-0.5 shrink-0">2</span>
              <p className="text-sm text-(--text-secondary)">Check the screen for order status</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#A8131E] flex items-center justify-center text-xs text-white mt-0.5 shrink-0">3</span>
              <p className="text-sm text-(--text-secondary)">Pick up your order when it&apos;s ready</p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3 animate-fade-in delay-4" style={{ opacity: 0 }}>
          {!isOffline && (
            <>
              <button
                onClick={handlePrint}
                disabled={printStatus === 'printing'}
                className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center gap-3 transition-all active:scale-95 border border-white/10 disabled:opacity-50"
              >
                {printStatus === 'printing' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Printing...
                  </>
                ) : printStatus === 'success' ? (
                  <>
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Struk Tercetak ✓
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    🧾 Cetak Struk
                  </>
                )}
              </button>
              
              {printStatus === 'fallback' && (
                <p className="text-xs text-amber-400 text-center">Print Bridge offline — menggunakan browser print</p>
              )}
            </>
          )}
          
          <button
            onClick={() => !isOffline && router.push(`/status?orderId=${orderId}`)}
            disabled={isOffline}
            className="btn-primary w-full disabled:opacity-50 disabled:grayscale"
          >
            {isOffline ? 'Tracking Unavailable (Offline)' : 'Track My Order'}
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="btn-ghost w-full"
          >
            Back to Home ({countdown}s)
          </button>
        </div>

        {/* Hidden Receipt — only visible during print */}
        {orderData && (
          <Receipt 
            orderId={(orderNo || orderData?.orderNo) || orderId || ''}
            queueNumber={queue}
            items={orderData.items || []}
            total={orderData.totalAmount || 0}
            discount={orderData.discount || 0}
            paymentMethod={orderData.paymentMethod || 'E-Wallet'}
          />
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#A8131E] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
