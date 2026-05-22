'use client';

import { useState, useEffect } from 'react';
import { useCartStore } from '@/stores/useCartStore';

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

function getMenuConfig(itemName: string, categorySlug: string) {
  const name = itemName.toLowerCase();
  const slug = categorySlug;

  let config = {
    showIce: false,
    showSugar: false,
    showMilk: false,
    showCream: false,
    showBeans: false,
    showShot: false,
    freeCream: false,
  };

  if (slug === 'rakken-signature') {
    if (name.includes('kyoto origin')) {
      config = { showIce: true, showSugar: true, showMilk: false, showCream: false, showBeans: true, showShot: true, freeCream: false };
    } else if (name.includes('kyoto house blend') || name.includes('kyoto sakura latte')) {
      config = { showIce: true, showSugar: true, showMilk: true, showCream: true, showBeans: true, showShot: true, freeCream: false };
    } else if (name.includes('yuzu coffee')) {
      config = { showIce: true, showSugar: true, showMilk: false, showCream: false, showBeans: true, showShot: true, freeCream: false };
    } else if (name.includes('dirty matcha')) {
      config = { showIce: true, showSugar: true, showMilk: true, showCream: true, showBeans: true, showShot: true, freeCream: true };
    }
  } else if (slug === 'rakken-style') {
    if (name.includes('rakken house blend') || name.includes('cafe latte') || name.includes('café latte') || name.includes('kokuto latte')) {
      config = { showIce: true, showSugar: true, showMilk: true, showCream: true, showBeans: true, showShot: true, freeCream: false };
    } else if (name.includes('cappuccino')) {
      config = { showIce: false, showSugar: true, showMilk: true, showCream: false, showBeans: true, showShot: true, freeCream: false };
    } else if (name.includes('long black') || name.includes('coconut coffee') || name.includes('apple spark coffee')) {
      config = { showIce: true, showSugar: true, showMilk: false, showCream: false, showBeans: true, showShot: true, freeCream: false };
    } else if (name.includes('sea salt caramel latte')) {
      config = { showIce: true, showSugar: true, showMilk: true, showCream: false, showBeans: true, showShot: true, freeCream: false };
    } else if (name.includes('butterscotch cloud coffee')) {
      config = { showIce: true, showSugar: true, showMilk: true, showCream: true, showBeans: true, showShot: true, freeCream: true };
    } else if (name.includes('kakao coffee') || name.includes('peach coffee') || name.includes('shakerato') || name.includes('shakareto')) {
      config = { showIce: false, showSugar: true, showMilk: true, showCream: false, showBeans: true, showShot: true, freeCream: false };
    }
  } else if (slug === 'non-coffee') {
    const isMatchaBerryLatte = name.includes('matcha berry latte');
    config = { showIce: true, showSugar: true, showMilk: true, showCream: !isMatchaBerryLatte, showBeans: false, showShot: false, freeCream: false };
  } else {
    // Fallback for other drinks
    const FOOD_CATEGORIES = ['dessert', 'snack', 'main-course', 'bites'];
    const isFood = FOOD_CATEGORIES.includes(slug);
    if (!isFood) {
      config.showIce = true;
      config.showSugar = true;
    }
    // Backward compatibility for old categories
    if (OPTIONAL_CHOICE_CATEGORIES.includes(slug)) {
      config.showCream = true;
    }
  }

  return config;
}

export default function CustomizeModal({ item, onClose }: CustomizeModalProps) {
  const { addItem } = useCartStore();
  const [optionalChoices, setOptionalChoices] = useState<Topping[]>([]);
  const [selectedSize, setSelectedSize] = useState('');
  const [sugarLevel, setSugarLevel] = useState('normal');
  const [iceLevel, setIceLevel] = useState('normal');
  const [milkChoice, setMilkChoice] = useState('dairy');
  const [beansChoice, setBeansChoice] = useState('rakken-blend');
  const [shotChoice, setShotChoice] = useState('normal');
  const [selectedChoices, setSelectedChoices] = useState<Topping[]>([]);
  const [quantity, setQuantity] = useState(1);

  const slug = item.category?.slug || item.categorySlug || '';
  const config = getMenuConfig(item.name as string, slug);
  const hasSizes = item.sizes.length > 0;

  const FOOD_CATEGORIES = ['dessert', 'snack', 'main-course', 'bites'];
  const isFood = slug ? FOOD_CATEGORIES.includes(slug) : item.type === 'none';
  const isDrink = !isFood;

  useEffect(() => {
    if (config.showCream) {
      if (slug === 'rakken-signature' || slug === 'rakken-style' || slug === 'non-coffee') {
        const creamPrice = config.freeCream ? 0 : 6000;
        setOptionalChoices([
          { id: 9004, name: 'Sea Salt Cream', price: creamPrice },
          { id: 9005, name: 'Cheese Cream', price: creamPrice },
        ]);
      } else {
        // Fallback logic
        setOptionalChoices([
          { id: 9001, name: 'Almond Milk', price: 6000 },
          { id: 9002, name: 'Espresso Shot', price: 6000 },
          { id: 9003, name: 'Whip Cream', price: 6000 },
        ]);
      }
    } else {
      setOptionalChoices([]);
    }
  }, [slug, config.showCream, config.freeCream]);

  // Set default selected size
  useEffect(() => {
    if (item.sizes.length > 0) {
      // Default to first available size
      setSelectedSize(item.sizes[0].size);
    }
  }, [item.sizes]);

  const milkChoices = [
    { key: 'dairy', label: 'Dairy Milk', sub: 'Susu standar', price: 0 },
    { key: 'skim', label: 'Skim Milk', sub: 'Low-fat', price: 6000 },
    { key: 'oat', label: 'Oat Milk', sub: 'Plant-based', price: 6000 },
  ];
  
  const beansChoices = [
    { key: 'rakken-blend', label: 'RAKKEN Blend', sub: 'House blend', price: 0 },
    { key: 'png-signature', label: 'PNG Signature', sub: 'Nutty profile', price: 6000 },
  ];

  const shotChoices = [
    { key: 'normal', label: 'Normal Shot', sub: 'Standar recipe', price: 0 },
    { key: 'extra-1', label: 'Extra 1 Shot', sub: '+1 shot', price: 6000 },
    { key: 'extra-2', label: 'Extra 2 Shots', sub: '+2 shots', price: 12000 },
  ];

  const selectedMilkPrice = config.showMilk ? (milkChoices.find(m => m.key === milkChoice)?.price || 0) : 0;
  const selectedBeansPrice = config.showBeans ? (beansChoices.find(b => b.key === beansChoice)?.price || 0) : 0;
  const selectedShotPrice = config.showShot ? (shotChoices.find(s => s.key === shotChoice)?.price || 0) : 0;

  const sizeAdjustment = item.sizes.find((s) => s.size === selectedSize)?.priceAdjustment || 0;
  
  const choicesTotal = selectedChoices.reduce((sum, t) => {
    // Determine price dynamically in case freeCream config applies
    const isCream = (t.id === 9004 || t.id === 9005 || t.id === 9003);
    const price = (config.freeCream && isCream) ? 0 : t.price;
    return sum + price;
  }, 0);

  const unitPrice = item.price + sizeAdjustment + choicesTotal + selectedMilkPrice + selectedBeansPrice + selectedShotPrice;
  const totalPrice = unitPrice * quantity;

  const sugarLevels = [
    { key: 'none', label: 'No Sugar', sub: 'Tanpa gula/syrup' },
    { key: 'less', label: 'Less Sugar', sub: 'gula 70%' },
    { key: 'normal', label: 'Normal Sugar', sub: 'Standar penyajian' },
    { key: 'more', label: 'More Sugar', sub: 'gula 130%' }
  ];
  const iceLevels = [
    { key: 'none', label: 'No Ice', sub: 'Tanpa es', icon: '🚫🧊' },
    { key: 'less', label: 'Less Ice', sub: 'es 70%', icon: '🧊' },
    { key: 'normal', label: 'Normal Ice', sub: 'Standar penyajian', icon: '🧊🧊' },
    { key: 'more', label: 'More Ice', sub: 'es 130%', icon: '🧊🧊🧊' },
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
    // Use robust matching (lowercase + trim) to handle subtle discrepancies in Olsera data
    const matchedVariant = item.olseraVariants?.find((v) => 
      v.name.toLowerCase().trim() === (selectedSize || '').toLowerCase().trim()
    );
    
    const finalToppings = selectedChoices.map((t) => {
      const isCream = (t.id === 9004 || t.id === 9005 || t.id === 9003);
      return { id: t.id, name: t.name, price: (config.freeCream && isCream) ? 0 : t.price };
    });

    if (config.showMilk && milkChoice !== 'dairy') {
      const selectedMilk = milkChoices.find(m => m.key === milkChoice);
      if (selectedMilk) finalToppings.push({ id: `milk-${selectedMilk.key}` as any, name: selectedMilk.label, price: selectedMilk.price });
    }
    if (config.showBeans && beansChoice !== 'rakken-blend') {
      const selectedBeans = beansChoices.find(b => b.key === beansChoice);
      if (selectedBeans) finalToppings.push({ id: `beans-${selectedBeans.key}` as any, name: selectedBeans.label, price: selectedBeans.price });
    }
    if (config.showShot && shotChoice !== 'normal') {
      const selectedShot = shotChoices.find(s => s.key === shotChoice);
      if (selectedShot) finalToppings.push({ id: `shot-${selectedShot.key}` as any, name: selectedShot.label, price: selectedShot.price });
    }
    
    addItem({
      id: `${item.id}-${Date.now()}`,
      menuItemId: item.id as number | string,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity,
      size: selectedSize || '',
      olseraVariantId: matchedVariant?.id,
      sugarLevel: config.showSugar ? sugarLevel : '',
      iceLevel: config.showIce ? iceLevel : '',
      extraShot: false,
      toppings: finalToppings,
      subtotal: totalPrice,
      category: typeof item.category === 'string' ? item.category : item.category?.name || '', // Pass the category along
    });
    onClose();
  };

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
                {isDrink ? 'Variant' : 'Option'}
              </h3>
              <div className={`grid gap-2 ${item.sizes.length <= 2 ? 'grid-cols-2' : item.sizes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {item.sizes.map((size) => (
                  <button
                    key={size.size}
                    onClick={() => setSelectedSize(size.size)}
                    className={`py-2.5 rounded-xl text-center transition-all ${
                      selectedSize === size.size
                        ? 'bg-[var(--brand-500)] text-white shadow-lg'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle) hover:border-[var(--brand-400)] hover:scale-[1.02] hover:shadow-sm'
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

          {/* Sugar Level */}
          {config.showSugar && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">
                Sugar Level
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {sugarLevels.map((level) => (
                  <button
                    key={level.key}
                    onClick={() => setSugarLevel(level.key)}
                    className={`py-2 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center min-h-[60px] ${
                      sugarLevel === level.key
                        ? 'bg-[var(--brand-500)] text-white shadow-md'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle) hover:border-[var(--brand-400)] hover:scale-[1.02]'
                    }`}
                  >
                    <span className="text-sm font-bold block leading-tight">{level.label}</span>
                    <span className="text-[10px] opacity-80 block mt-0.5 leading-tight">{level.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ice Level */}
          {config.showIce && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">Ice Level</h3>
              <div className="grid grid-cols-2 gap-2">
                {iceLevels.map((ice) => (
                  <button
                    key={ice.key}
                    onClick={() => setIceLevel(ice.key)}
                    className={`py-2 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center min-h-[60px] ${
                      iceLevel === ice.key
                        ? 'bg-[var(--brand-500)] text-white shadow-md'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle) hover:border-[var(--brand-400)] hover:scale-[1.02]'
                    }`}
                  >
                    <span className="text-sm font-bold block flex items-center justify-center gap-1 leading-tight">
                      {ice.icon} {ice.label}
                    </span>
                    <span className="text-[10px] opacity-80 block mt-0.5 leading-tight">{ice.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Beans Choice */}
          {config.showBeans && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">Beans Choice</h3>
              <div className="grid grid-cols-2 gap-2">
                {beansChoices.map((bean) => (
                  <button
                    key={bean.key}
                    onClick={() => setBeansChoice(bean.key)}
                    className={`py-2 px-2 rounded-xl text-center transition-all flex flex-col items-center justify-center min-h-[60px] ${
                      beansChoice === bean.key
                        ? 'bg-[var(--brand-500)] text-white shadow-md'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle)'
                    }`}
                  >
                    <span className="text-sm font-bold block leading-tight">{bean.label}</span>
                    <span className="text-[10px] opacity-80 block mt-0.5 leading-tight">{bean.sub}</span>
                    {bean.price > 0 && <span className="text-xs font-bold mt-1">+{formatCurrency(bean.price)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Coffee Shot */}
          {config.showShot && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">Coffee Shot</h3>
              <div className="grid grid-cols-3 gap-2">
                {shotChoices.map((shot) => (
                  <button
                    key={shot.key}
                    onClick={() => setShotChoice(shot.key)}
                    className={`py-2 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center min-h-[60px] ${
                      shotChoice === shot.key
                        ? 'bg-[var(--brand-500)] text-white shadow-md'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle)'
                    }`}
                  >
                    <span className="text-xs font-bold block leading-tight">{shot.label}</span>
                    <span className="text-[9px] opacity-80 block mt-0.5 leading-tight">{shot.sub}</span>
                    {shot.price > 0 && <span className="text-xs font-bold mt-1">+{formatCurrency(shot.price)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Milk Choice */}
          {config.showMilk && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">
                Milk Choice
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {milkChoices.map((milk) => (
                  <button
                    key={milk.key}
                    onClick={() => setMilkChoice(milk.key)}
                    className={`py-2 px-3 rounded-xl text-center transition-all flex flex-col items-center justify-center min-h-[60px] ${
                      milkChoice === milk.key
                        ? 'bg-[var(--brand-500)] text-white shadow-md'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle)'
                    }`}
                  >
                    <span className="text-sm font-bold block leading-tight">{milk.label}</span>
                    <span className="text-[10px] opacity-80 block mt-0.5 leading-tight">{milk.sub}</span>
                    {milk.price > 0 && (
                      <span className="text-xs mt-1 block font-semibold">+{formatCurrency(milk.price)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Choice / Cream Add On */}
          {config.showCream && optionalChoices.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">
                Cream Add On
              </h3>
              <div className="space-y-2">
                {optionalChoices.map((choice) => {
                  const isSelected = selectedChoices.find((t) => t.id === choice.id);
                  const isFree = config.freeCream && (choice.id === 9004 || choice.id === 9005 || choice.id === 9003);
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
                      <span className="text-xs font-bold text-(--text-primary)">
                        {isFree ? 'FREE' : `+${formatCurrency(choice.price)}`}
                      </span>
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
                className="w-12 h-12 rounded-full bg-[var(--brand-500)] flex items-center justify-center text-xl text-white shadow-lg hover:shadow-xl transition-all active:scale-90"
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
