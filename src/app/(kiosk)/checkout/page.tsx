'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const paymentMethods = [
  { key: 'QRIS', label: 'QRIS', icon: '📱', desc: 'Scan QR code to pay' },
  { key: 'E-Wallet', label: 'E-Wallet', icon: '💳', desc: 'GoPay, OVO, DANA, etc.' },
  { key: 'Debit/Credit', label: 'Debit / Credit', icon: '💲', desc: 'Tap or insert your card' },
  { key: 'Cash', label: 'Cash', icon: '💵', desc: 'Pay at the counter' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart, itemCount } = useCart();
  const [selectedPayment, setSelectedPayment] = useState('QRIS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentSim, setShowPaymentSim] = useState(false);
  const checkoutInProgress = useRef(false);

  useEffect(() => {
    if (itemCount === 0 && !checkoutInProgress.current) {
      router.push('/menu');
    }
  }, [itemCount, router]);

  const handleCheckout = async () => {
    checkoutInProgress.current = true;
    setShowPaymentSim(true);

    // Simulate payment processing
    setTimeout(async () => {
      setIsProcessing(true);

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalAmount: cart.totalAmount,
            paymentMethod: selectedPayment,
            items: cart.items.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              size: item.size,
              sugarLevel: item.sugarLevel,
              iceLevel: item.iceLevel,
              extraShot: item.extraShot,
              subtotal: item.subtotal,
              toppingIds: item.toppings.map((t) => t.id),
            })),
          }),
        });

        const order = await res.json();
        clearCart();
        router.push(`/success?orderId=${order.id}&queue=${order.queueNumber}`);
      } catch (error) {
        console.error('Checkout error:', error);
        setIsProcessing(false);
        setShowPaymentSim(false);
        alert('Payment failed. Please try again.');
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/cart')} className="btn-ghost flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Cart
          </button>
          <h1 className="text-xl font-bold text-gradient">Checkout</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Order Summary */}
        <div className="glass-card p-5 animate-fade-in">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Order Summary</h2>
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-muted)]">{item.quantity}x</span>
                  <span className="text-sm text-[var(--text-primary)]">{item.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">({item.size})</span>
                </div>
                <span className="text-sm text-[var(--text-secondary)]">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--border-subtle)] mt-4 pt-4 flex items-center justify-between">
            <span className="font-semibold text-[var(--text-primary)]">Total</span>
            <span className="text-xl font-bold text-gradient">{formatCurrency(cart.totalAmount)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="animate-fade-in delay-1" style={{ opacity: 0 }}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Payment Method</h2>
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <button
                key={method.key}
                onClick={() => setSelectedPayment(method.key)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                  selectedPayment === method.key
                    ? 'bg-gradient-to-r from-coffee-500/20 to-amber-600/20 border-2 border-coffee-500/60 shadow-lg shadow-coffee-500/10'
                    : 'glass-card'
                }`}
              >
                <span className="text-3xl">{method.icon}</span>
                <div className="text-left flex-1">
                  <span className="font-semibold text-[var(--text-primary)] block">{method.label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{method.desc}</span>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedPayment === method.key
                    ? 'border-coffee-500 bg-coffee-500'
                    : 'border-[var(--border-default)]'
                }`}>
                  {selectedPayment === method.key && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <div className="sticky bottom-0 glass p-6 border-t border-[var(--border-subtle)]">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleCheckout}
            disabled={isProcessing}
            className="btn-primary w-full py-5 text-lg rounded-2xl flex items-center justify-center gap-3"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Pay {formatCurrency(cart.totalAmount)}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Payment Simulation Modal */}
      {showPaymentSim && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative glass-card p-8 text-center max-w-sm mx-4 animate-scale-in">
            {isProcessing ? (
              <>
                <div className="w-16 h-16 border-4 border-coffee-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Processing Payment</h3>
                <p className="text-[var(--text-muted)]">Please wait...</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-6 animate-pulse-glow inline-block">
                  {selectedPayment === 'QRIS' ? '📱' : selectedPayment === 'E-Wallet' ? '💳' : selectedPayment === 'Cash' ? '💵' : '💲'}
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                  {selectedPayment === 'QRIS' ? 'Scan QR Code' : selectedPayment === 'Cash' ? 'Pay at Counter' : 'Tap Your Card'}
                </h3>
                <p className="text-[var(--text-muted)] mb-4">Simulating payment...</p>
                <div className="w-48 h-48 mx-auto bg-white rounded-2xl p-4 mb-4 flex items-center justify-center">
                  <div className="grid grid-cols-5 gap-1">
                    {[...Array(25)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-6 h-6 rounded-sm ${Math.random() > 0.3 ? 'bg-black' : 'bg-white'}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-2xl font-bold text-gradient">{formatCurrency(cart.totalAmount)}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
