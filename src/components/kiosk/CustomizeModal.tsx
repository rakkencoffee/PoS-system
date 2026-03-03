'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';

interface Topping {
  id: number;
  name: string;
  price: number;
}

interface MenuItemSize {
  id: number;
  size: string;
  priceAdjustment: number;
}

interface CustomizeModalProps {
  item: {
    id: number;
    name: string;
    description: string;
    price: number;
    image: string;
    type: string;
    sizes: MenuItemSize[];
  };
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CustomizeModal({ item, onClose }: CustomizeModalProps) {
  const { addItem } = useCart();
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [selectedSize, setSelectedSize] = useState('M');
  const [sugarLevel, setSugarLevel] = useState(100);
  const [iceLevel, setIceLevel] = useState('normal');
  const [extraShot, setExtraShot] = useState(false);
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([]);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetch('/api/toppings')
      .then((res) => res.json())
      .then(setToppings)
      .catch(console.error);
  }, []);

  const sizeAdjustment = item.sizes.find((s) => s.size === selectedSize)?.priceAdjustment || 0;
  const toppingsTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0);
  const extraShotPrice = extraShot ? 8000 : 0;
  const unitPrice = item.price + sizeAdjustment + toppingsTotal + extraShotPrice;
  const totalPrice = unitPrice * quantity;

  const sugarLevels = [0, 25, 50, 75, 100];
  const iceLevels = [
    { key: 'none', label: 'No Ice', icon: '🚫' },
    { key: 'less', label: 'Less', icon: '🧊' },
    { key: 'normal', label: 'Normal', icon: '🧊🧊' },
    { key: 'more', label: 'Extra', icon: '🧊🧊🧊' },
  ];

  const toggleTopping = (topping: Topping) => {
    setSelectedToppings((prev) =>
      prev.find((t) => t.id === topping.id)
        ? prev.filter((t) => t.id !== topping.id)
        : [...prev, topping]
    );
  };

  const handleAddToCart = () => {
    addItem({
      id: `${item.id}-${Date.now()}`,
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity,
      size: selectedSize,
      sugarLevel,
      iceLevel,
      extraShot,
      toppings: selectedToppings.map((t) => ({ id: t.id, name: t.name, price: t.price })),
      subtotal: totalPrice,
    });
    onClose();
  };

  const hasSizes = item.sizes.length > 0;
  const showIceOption = item.type === 'iced' || item.type === 'both';

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-3xl glass animate-slide-up"
        style={{ background: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-[var(--border-subtle)]"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{item.name}</h2>
            <p className="text-sm text-[var(--text-muted)]">{item.description}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Size Selection */}
          {hasSizes && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Size</h3>
              <div className="grid grid-cols-3 gap-3">
                {item.sizes.map((size) => (
                  <button
                    key={size.size}
                    onClick={() => setSelectedSize(size.size)}
                    className={`py-3 rounded-xl text-center transition-all ${
                      selectedSize === size.size
                        ? 'bg-gradient-to-r from-coffee-500 to-amber-600 text-white shadow-lg'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                    }`}
                  >
                    <span className="block text-lg font-bold">{size.size}</span>
                    <span className="block text-xs mt-1 opacity-80">
                      {size.priceAdjustment === 0
                        ? 'Base'
                        : `${size.priceAdjustment > 0 ? '+' : ''}${formatCurrency(size.priceAdjustment)}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sugar Level */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Sugar Level — {sugarLevel}%
            </h3>
            <div className="flex gap-2">
              {sugarLevels.map((level) => (
                <button
                  key={level}
                  onClick={() => setSugarLevel(level)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    sugarLevel === level
                      ? 'bg-gradient-to-r from-coffee-500 to-amber-600 text-white shadow-lg'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                  }`}
                >
                  {level}%
                </button>
              ))}
            </div>
          </div>

          {/* Ice Level */}
          {showIceOption && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Ice Level</h3>
              <div className="grid grid-cols-4 gap-2">
                {iceLevels.map((ice) => (
                  <button
                    key={ice.key}
                    onClick={() => setIceLevel(ice.key)}
                    className={`py-3 rounded-xl text-center transition-all ${
                      iceLevel === ice.key
                        ? 'bg-gradient-to-r from-coffee-500 to-amber-600 text-white shadow-lg'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    <span className="block text-lg">{ice.icon}</span>
                    <span className="block text-xs mt-1">{ice.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Extra Shot */}
          <div>
            <button
              onClick={() => setExtraShot(!extraShot)}
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                extraShot
                  ? 'bg-gradient-to-r from-coffee-500/20 to-amber-600/20 border border-coffee-500/50'
                  : 'bg-[var(--bg-card)] border border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">💪</span>
                <div className="text-left">
                  <span className="font-medium text-[var(--text-primary)] block">Extra Shot</span>
                  <span className="text-xs text-[var(--text-muted)]">Double the caffeine</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">+{formatCurrency(8000)}</span>
                <div className={`w-12 h-7 rounded-full transition-all flex items-center px-1 ${
                  extraShot ? 'bg-coffee-500' : 'bg-coffee-800'
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    extraShot ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </div>
            </button>
          </div>

          {/* Toppings */}
          {toppings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Toppings</h3>
              <div className="grid grid-cols-2 gap-2">
                {toppings.map((topping) => {
                  const isSelected = selectedToppings.find((t) => t.id === topping.id);
                  return (
                    <button
                      key={topping.id}
                      onClick={() => toggleTopping(topping)}
                      className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-coffee-500/20 to-amber-600/20 border border-coffee-500/50'
                          : 'bg-[var(--bg-card)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      <span className="text-sm text-[var(--text-primary)] font-medium">{topping.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">+{formatCurrency(topping.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Quantity</h3>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center text-xl text-[var(--text-primary)] hover:border-[var(--border-default)] transition-all active:scale-90"
              >
                −
              </button>
              <span className="text-3xl font-bold text-[var(--text-primary)] w-12 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 rounded-full bg-gradient-to-r from-coffee-500 to-amber-600 flex items-center justify-center text-xl text-white shadow-lg hover:shadow-xl transition-all active:scale-90"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-5 border-t border-[var(--border-subtle)]"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <button
            onClick={handleAddToCart}
            className="btn-primary w-full flex items-center justify-between text-lg py-4 rounded-2xl"
          >
            <span>Add to Cart</span>
            <span className="font-bold">{formatCurrency(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
