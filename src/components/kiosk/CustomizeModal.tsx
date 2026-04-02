'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';

interface Topping {
  id: number;
  name: string;
  price: number;
}

interface MenuItemSize {
  id?: number;
  size: string;
  priceAdjustment: number;
}

interface CustomizeModalProps {
  item: {
    id: number | string;
    name: string;
    description: string;
    price: number;
    image: string;
    type: string;
    sizes: MenuItemSize[];
    category?: { name: string; slug: string };
    categorySlug?: string;
    olseraVariants?: { id: number; name: string; price: number }[];
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

// Categories that show Optional Choice
const OPTIONAL_CHOICE_CATEGORIES = ['coffee-based', 'milk-based'];

export default function CustomizeModal({ item, onClose }: CustomizeModalProps) {
  const { addItem } = useCart();
  const [optionalChoices, setOptionalChoices] = useState<Topping[]>([]);
  const [selectedSize, setSelectedSize] = useState('');
  const [sugarLevel, setSugarLevel] = useState('normal');
  const [iceLevel, setIceLevel] = useState('normal');
  const [selectedChoices, setSelectedChoices] = useState<Topping[]>([]);
  const [quantity, setQuantity] = useState(1);

  const slug = item.category?.slug || item.categorySlug || '';
  const FOOD_CATEGORIES = ['dessert', 'snack', 'main-course'];
  const isFood = slug ? FOOD_CATEGORIES.includes(slug) : item.type === 'none';
  const hasSizes = item.sizes.length > 0;
  const isDrink = !isFood;
  const showOptionalChoice = OPTIONAL_CHOICE_CATEGORIES.includes(slug);

  useEffect(() => {
    if (showOptionalChoice) {
      // Hardcoded addons logic for Coffee Based & Milk Based
      setOptionalChoices([
        { id: 9001, name: 'Almond Milk', price: 6000 },
        { id: 9002, name: 'Espresso Shot', price: 6000 },
        { id: 9003, name: 'Whip Cream', price: 6000 },
      ]);
    }
  }, [showOptionalChoice]);

  // Set default selected size
  useEffect(() => {
    if (item.sizes.length > 0) {
      // Default to first available size
      setSelectedSize(item.sizes[0].size);
    }
  }, [item.sizes]);

  const sizeAdjustment = item.sizes.find((s) => s.size === selectedSize)?.priceAdjustment || 0;
  const choicesTotal = selectedChoices.reduce((sum, t) => sum + t.price, 0);
  const unitPrice = item.price + sizeAdjustment + choicesTotal;
  const totalPrice = unitPrice * quantity;

  const sugarLevels = [
    { key: 'less', label: 'Less' },
    { key: 'normal', label: 'Normal' },
    { key: 'more', label: 'More' }
  ];
  const iceLevels = [
    { key: 'less', label: 'Less', icon: '🧊' },
    { key: 'normal', label: 'Normal', icon: '🧊🧊' },
    { key: 'more', label: 'More', icon: '🧊🧊🧊' },
  ];

  const toggleChoice = (choice: Topping) => {
    setSelectedChoices((prev) =>
      prev.find((t) => t.id === choice.id)
        ? prev.filter((t) => t.id !== choice.id)
        : [...prev, choice]
    );
  };

  const handleAddToCart = () => {
    // Look up the Olsera variant ID that matches the selected size name
    const matchedVariant = item.olseraVariants?.find((v) => v.name === selectedSize);
    
    addItem({
      id: `${item.id}-${Date.now()}`,
      menuItemId: item.id as number | string,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity,
      size: selectedSize || '-',
      olseraVariantId: matchedVariant?.id,
      sugarLevel: isDrink ? sugarLevel : 'normal',
      iceLevel: isDrink ? iceLevel : 'normal',
      extraShot: false,
      toppings: selectedChoices.map((t) => ({ id: t.id, name: t.name, price: t.price })),
      subtotal: totalPrice,
    });
    onClose();
  };

  const showIceOption = isDrink && (item.type === 'iced' || item.type === 'both');

  // Size label mapping
  const sizeLabel = (size: string) => {
    switch (size) {
      case 'Hot': return '🔥 Hot';
      case 'Ice': return '🧊 Ice';
      case 'Upsize': return '⬆️ Upsize';
      default: return size;
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-end md:items-center justify-center">
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
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-(--border-subtle)"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <div>
            <h2 className="text-xl font-bold text-(--text-primary)">{item.name}</h2>
            <p className="text-sm text-(--text-muted)">{item.description}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-(--text-secondary) hover:text-(--text-primary) transition-colors">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Size Selection (Hot / Ice / Upsize for drinks) */}
          {hasSizes && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">
                {isDrink ? 'Variant' : 'Size'}
              </h3>
              <div className={`grid gap-2 ${item.sizes.length <= 2 ? 'grid-cols-2' : item.sizes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {item.sizes.map((size) => (
                  <button
                    key={size.size}
                    onClick={() => setSelectedSize(size.size)}
                    className={`py-2.5 rounded-xl text-center transition-all ${
                      selectedSize === size.size
                        ? 'bg-linear-to-r from-[#c41525] to-[#A8131E] text-white shadow-lg'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle) hover:border-(--border-default)'
                    }`}
                  >
                    <span className="block text-sm font-bold">{sizeLabel(size.size)}</span>
                    <span className="block text-[10px] mt-0.5 opacity-80">
                      {size.priceAdjustment === 0
                        ? 'Base'
                        : `${size.priceAdjustment > 0 ? '+' : ''}${formatCurrency(size.priceAdjustment)}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sugar Level (drinks only) */}
          {isDrink && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">
                Sugar Level
              </h3>
              <div className="flex gap-2">
                {sugarLevels.map((level) => (
                  <button
                    key={level.key}
                    onClick={() => setSugarLevel(level.key)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      sugarLevel === level.key
                        ? 'bg-linear-to-r from-[#c41525] to-[#A8131E] text-white shadow-lg'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle)'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ice Level (drinks only, if applicable) */}
          {showIceOption && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">Ice Level</h3>
              <div className="flex gap-2">
                {iceLevels.map((ice) => (
                  <button
                    key={ice.key}
                    onClick={() => setIceLevel(ice.key)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      iceLevel === ice.key
                        ? 'bg-linear-to-r from-[#c41525] to-[#A8131E] text-white shadow-lg'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle)'
                    }`}
                  >
                    <span className="mr-1">{ice.icon}</span>
                    {ice.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Choice (Coffee & Milk Based only) */}
          {showOptionalChoice && optionalChoices.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">Optional Choice</h3>
              <div className="space-y-2">
                {optionalChoices.map((choice) => {
                  const isSelected = selectedChoices.find((t) => t.id === choice.id);
                  return (
                    <button
                      key={choice.id}
                      onClick={() => toggleChoice(choice)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${
                        isSelected
                          ? 'bg-linear-to-r from-[#A8131E]/20 to-[#8B0F19]/20 border border-[#A8131E]/50'
                          : 'bg-(--bg-card) border border-(--border-subtle)'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-[#A8131E] border-[#A8131E]' : 'border-white/30'
                        }`}>
                          {isSelected && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className="text-sm text-(--text-primary) font-medium">{choice.name}</span>
                      </div>
                      <span className="text-xs text-(--text-muted)">+{formatCurrency(choice.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">Quantity</h3>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 rounded-full bg-(--bg-card) border border-(--border-subtle) flex items-center justify-center text-xl text-(--text-primary) hover:border-(--border-default) transition-all active:scale-90"
              >
                −
              </button>
              <span className="text-3xl font-bold text-(--text-primary) w-12 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 rounded-full bg-linear-to-r from-[#c41525] to-[#A8131E] flex items-center justify-center text-xl text-white shadow-lg hover:shadow-xl transition-all active:scale-90"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-5 border-t border-(--border-subtle)"
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
