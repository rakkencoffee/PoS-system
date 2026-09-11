'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCartStore } from '@/stores/useCartStore';
import { CartItem } from '@/lib/types';

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
  editingCartItem?: CartItem;
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

// Coffee bean flavor -- a real Olsera variant dimension, baked into the
// variant name as its trailing comma segment (e.g. "Hot,Small,Bold & Nutty").
// Order here also drives display order and the default ("Roar", no add-on).
const BEAN_FLAVORS = ['Roar', 'Bold & Nutty', 'Rich & Fruity'];

function matchBeanFlavor(segment: string): string | null {
  const trimmed = segment.trim();
  return BEAN_FLAVORS.find((b) => b.toLowerCase() === trimmed.toLowerCase()) || null;
}

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
    // Bean flavor (Roar / Bold & Nutty / Rich & Fruity) is now a real Olsera
    // variant (e.g. "Hot,Small,Roar"), surfaced via its own "Coffee Beans"
    // group derived from beanVariantInfo -- not this local Beans Choice
    // selector -- so showBeans stays false here to avoid offering it twice.
    if (name.includes('kyoto origin')) {
      config = { showIce: true, showSugar: true, showMilk: false, showCream: false, showBeans: false, showShot: true, freeCream: false };
    } else if (name.includes('kyoto house blend') || name.includes('kyoto sakura latte')) {
      config = { showIce: true, showSugar: true, showMilk: true, showCream: true, showBeans: false, showShot: true, freeCream: false };
    } else if (name.includes('yuzu coffee')) {
      config = { showIce: true, showSugar: true, showMilk: false, showCream: false, showBeans: false, showShot: true, freeCream: false };
    } else if (name.includes('dirty matcha')) {
      config = { showIce: true, showSugar: true, showMilk: true, showCream: true, showBeans: false, showShot: true, freeCream: true };
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

export default function CustomizeModal({ item, onClose, editingCartItem }: CustomizeModalProps) {
  const { addItem, updateItem } = useCartStore();
  const isEditMode = !!editingCartItem;

  // Parse existing toppings from editingCartItem to recover milk/beans/shot/cream state
  const parsedEdit = (() => {
    if (!editingCartItem) return null;
    let milk = 'dairy';
    let beans = 'rakken-blend';
    let shot = 'normal';
    const creamChoices: Topping[] = [];
    for (const t of editingCartItem.toppings) {
      const tid = String(t.id);
      if (tid.startsWith('milk-')) { milk = tid.replace('milk-', ''); }
      else if (tid.startsWith('beans-')) { beans = tid.replace('beans-', ''); }
      else if (tid.startsWith('shot-')) { shot = tid.replace('shot-', ''); }
      else { creamChoices.push({ id: t.id as number, name: t.name, price: t.price }); }
    }
    return { milk, beans, shot, creamChoices };
  })();

  // Groups this item's raw Olsera variants (e.g. "Hot,Small,Bold & Nutty")
  // into a base variant (temp+size, e.g. "Hot,Small" -- same set as before
  // bean flavors existed) crossed with a bean flavor, so the UI can offer
  // them as two separate pick-one groups instead of one flat list of long
  // combined labels. Returns null for items that don't have a uniform bean
  // dimension (RAKKEN Style, food, or Signature items before their Olsera
  // variants are migrated) -- those keep the original flat "Variant" grid.
  const beanVariantInfo = useMemo(() => {
    const variants = item.olseraVariants || [];
    if (variants.length === 0) return null;

    const parsed = variants.map((v) => {
      const segments = v.name.split(',').map((s) => s.trim());
      const bean = matchBeanFlavor(segments[segments.length - 1]);
      const baseKey = bean ? segments.slice(0, -1).join(',') : v.name;
      return { variant: v, baseKey, bean };
    });

    if (!parsed.every((p) => p.bean !== null) || parsed.some((p) => p.baseKey === '')) {
      return null;
    }

    const baseKeys: string[] = [];
    for (const p of parsed) {
      if (!baseKeys.includes(p.baseKey)) baseKeys.push(p.baseKey);
    }
    return { parsed, baseKeys };
  }, [item.olseraVariants]);

  // Recover the base variant (without the bean suffix) from a previously
  // saved cart item's `size`, so re-opening it for edit lands on the same
  // temp/size AND bean flavor instead of losing the flavor half back to
  // the raw combined string.
  const stripBeanSuffix = (size: string): string => {
    const segments = size.split(',').map((s) => s.trim());
    return matchBeanFlavor(segments[segments.length - 1]) ? segments.slice(0, -1).join(',') : size;
  };

  const [optionalChoices, setOptionalChoices] = useState<Topping[]>([]);
  const [selectedSize, setSelectedSize] = useState(
    editingCartItem?.size ? stripBeanSuffix(editingCartItem.size) : ''
  );
  const [selectedBeanFlavor, setSelectedBeanFlavor] = useState<string>(() => {
    if (!editingCartItem) return BEAN_FLAVORS[0];
    const segments = editingCartItem.size.split(',').map((s) => s.trim());
    return matchBeanFlavor(segments[segments.length - 1]) || BEAN_FLAVORS[0];
  });
  const [sugarLevel, setSugarLevel] = useState(editingCartItem?.sugarLevel || 'normal');
  const [iceLevel, setIceLevel] = useState(editingCartItem?.iceLevel || 'normal');
  const [milkChoice, setMilkChoice] = useState(parsedEdit?.milk || 'dairy');
  const [beansChoice, setBeansChoice] = useState(parsedEdit?.beans || 'rakken-blend');
  const [shotChoice, setShotChoice] = useState(parsedEdit?.shot || 'normal');
  const [selectedChoices, setSelectedChoices] = useState<Topping[]>(parsedEdit?.creamChoices || []);
  const [quantity, setQuantity] = useState(editingCartItem?.quantity || 1);

  const slug = item.category?.slug || item.categorySlug || '';
  const config = getMenuConfig(item.name as string, slug);

  // "Variant" grid source: the item's base temp/size combos when this item
  // has a bean dimension (priced off each combo's "Roar" entry, matching
  // what these prices were before bean flavors existed), otherwise the
  // plain item.sizes exactly as before.
  const displaySizes: MenuItemSize[] = beanVariantInfo
    ? beanVariantInfo.baseKeys.map((baseKey) => {
        const roarEntry = beanVariantInfo.parsed.find((p) => p.baseKey === baseKey && p.bean === BEAN_FLAVORS[0]);
        return { size: baseKey, priceAdjustment: (roarEntry?.variant.price ?? item.price) - item.price };
      })
    : item.sizes;
  const hasSizes = displaySizes.length > 0;

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

  // Set default selected size (only when NOT editing)
  useEffect(() => {
    if (isEditMode) return;
    if (displaySizes.length > 0) {
      setSelectedSize(displaySizes[0].size);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.sizes, beanVariantInfo, isEditMode]);

  // Lock background scroll while the modal is open — otherwise touch/trackpad
  // scroll gestures that start on the backdrop can scroll the page behind it.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const milkChoices = [
    { key: 'dairy', label: 'Dairy Milk', sub: 'Susu standar', price: 0 },
    { key: 'skim', label: 'Skim Milk', sub: 'Low-fat', price: 6000 },
    { key: 'oat', label: 'Oat Milk', sub: 'Plant-based', price: 6000 },
  ];
  
  // RAKKEN Style only ever uses RAKKEN Blend -- no alternative bean here, so
  // this renders as a single, non-priced informational choice (not a real
  // decision). Signature's beans are now picked via the Variant/size grid
  // (see getMenuConfig's showBeans: false above), not this list.
  const beansChoices = [
    { key: 'rakken-blend', label: 'RAKKEN BLEND', sub: 'House blend', price: 0 },
  ];

  const shotChoices = [
    { key: 'normal', label: 'Normal Shot', sub: 'Standar recipe', price: 0 },
    { key: 'extra-1', label: 'Extra 1 Shot', sub: '+1 shot', price: 6000 },
    { key: 'extra-2', label: 'Extra 2 Shots', sub: '+2 shots', price: 12000 },
  ];

  const selectedMilkPrice = config.showMilk ? (milkChoices.find(m => m.key === milkChoice)?.price || 0) : 0;
  const selectedBeansPrice = config.showBeans ? (beansChoices.find(b => b.key === beansChoice)?.price || 0) : 0;
  const selectedShotPrice = config.showShot ? (shotChoices.find(s => s.key === shotChoice)?.price || 0) : 0;

  // The exact combo currently picked (base variant + bean flavor), when this
  // item has a bean dimension -- this is what actually gets billed/synced to
  // Olsera, since bean flavor changes the price.
  const selectedBeanVariant = beanVariantInfo?.parsed.find(
    (p) => p.baseKey === selectedSize && p.bean === selectedBeanFlavor
  );

  const sizeAdjustment = beanVariantInfo
    ? (selectedBeanVariant?.variant.price ?? item.price) - item.price
    : displaySizes.find((s) => s.size === selectedSize)?.priceAdjustment || 0;

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
    { key: 'none', label: 'No Ice', sub: 'Tanpa es' },
    { key: 'less', label: 'Less Ice', sub: 'es 70%' },
    { key: 'normal', label: 'Normal Ice', sub: 'Standar penyajian' },
    { key: 'more', label: 'More Ice', sub: 'es 130%' },
  ];

  const toggleChoice = (choice: Topping) => {
    setSelectedChoices((prev) =>
      prev.find((t) => t.id === choice.id)
        ? prev.filter((t) => t.id !== choice.id)
        : [...prev, choice]
    );
  };

  const handleSubmit = () => {
    // Look up the Olsera variant that matches what's currently selected --
    // for bean-dimension items this is the precomputed base+bean combo
    // (selectedBeanVariant), otherwise fall back to matching selectedSize
    // directly (lowercase + trim, to handle subtle discrepancies in Olsera data).
    const matchedVariant = beanVariantInfo
      ? selectedBeanVariant?.variant
      : item.olseraVariants?.find((v) =>
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

    const cartItemData: CartItem = {
      id: isEditMode ? editingCartItem!.id : `${item.id}-${Date.now()}`,
      menuItemId: item.id as number | string,
      name: item.name,
      price: item.price + sizeAdjustment,
      image: item.image,
      quantity,
      // For bean-dimension items, store the full raw Olsera combo name (e.g.
      // "Hot,Small,Bold & Nutty") rather than just the base variant -- this
      // is what prints on the KDS/receipt "Size:" line, and baristas need to
      // see the bean flavor there since it changes which beans they grab.
      size: (beanVariantInfo ? matchedVariant?.name : selectedSize) || selectedSize || '',
      olseraVariantId: matchedVariant?.id,
      sugarLevel: config.showSugar ? sugarLevel : '',
      iceLevel: config.showIce ? iceLevel : '',
      extraShot: false,
      toppings: finalToppings,
      subtotal: totalPrice,
      category: typeof item.category === 'string' ? item.category : item.category?.name || '',
      categorySlug: slug,
    };

    if (isEditMode) {
      updateItem(editingCartItem!.id, cartItemData);
    } else {
      addItem(cartItemData);
    }
    onClose();
  };


  return (
    <div className="fixed inset-0 z-100 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal — flex column so the header/footer stay fixed in normal flow
          and only the body scrolls. The old layout put overflow-y-auto on
          this same element while the header/footer were `sticky` inside it,
          which is what caused the scroll glitches. */}
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl md:rounded-3xl glass animate-slide-up overflow-hidden"
        style={{ background: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-4 p-5 border-b border-(--border-subtle)">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-(--text-primary) truncate">{item.name}</h2>
            {item.description && (
              <p className="text-sm text-(--text-muted) whitespace-pre-line line-clamp-2">{item.description.replace(/\\n/g, '\n')}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-(--text-secondary) hover:text-(--text-primary) transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-6">
          {/* Size Selection (Hot / Ice / Upsize for drinks) */}
          {hasSizes && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">
                {isDrink ? 'Variant' : 'Option'}
              </h3>
              <div className={`grid gap-2 ${displaySizes.length <= 2 ? 'grid-cols-2' : displaySizes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {displaySizes.map((size) => (
                  <button
                    key={size.size}
                    onClick={() => setSelectedSize(size.size)}
                    className={`py-2.5 rounded-xl text-center transition-all ${
                      selectedSize === size.size
                        ? 'bg-[var(--brand-500)] text-white shadow-lg'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle) hover:border-[var(--brand-400)] hover:scale-[1.02] hover:shadow-sm'
                    }`}
                  >
                    <span className="block text-sm font-bold">{size.size}</span>
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

          {/* Coffee Beans -- the real Olsera variant dimension, shown as its
              own pick-one group instead of baked into the Variant labels above. */}
          {beanVariantInfo && (
            <div>
              <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">Coffee Beans</h3>
              <div className="grid grid-cols-3 gap-2">
                {BEAN_FLAVORS.map((flavor) => {
                  const roarEntry = beanVariantInfo.parsed.find((p) => p.baseKey === selectedSize && p.bean === BEAN_FLAVORS[0]);
                  const flavorEntry = beanVariantInfo.parsed.find((p) => p.baseKey === selectedSize && p.bean === flavor);
                  const priceDelta = (flavorEntry?.variant.price ?? 0) - (roarEntry?.variant.price ?? 0);
                  return (
                    <button
                      key={flavor}
                      onClick={() => setSelectedBeanFlavor(flavor)}
                      className={`py-2 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center min-h-[60px] ${
                        selectedBeanFlavor === flavor
                          ? 'bg-[var(--brand-500)] text-white shadow-md'
                          : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle)'
                      }`}
                    >
                      <span className="text-xs font-bold block leading-tight">{flavor}</span>
                      {priceDelta > 0 && <span className="text-[10px] font-bold mt-1">+{formatCurrency(priceDelta)}</span>}
                    </button>
                  );
                })}
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
                    <span className="text-sm font-bold block leading-tight">{ice.label}</span>
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
              <div className={`grid gap-2 ${beansChoices.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
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
                          {isSelected && <span className="material-symbols-outlined text-white" style={{ fontSize: '14px' }}>check</span>}
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
                aria-label="Kurangi jumlah"
                className="w-12 h-12 rounded-full bg-(--bg-card) border border-(--border-subtle) flex items-center justify-center text-(--text-primary) hover:border-(--border-default) transition-all active:scale-90"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>remove</span>
              </button>
              <span className="text-3xl font-bold text-(--text-primary) w-12 text-center tabular-nums">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Tambah jumlah"
                className="w-12 h-12 rounded-full bg-[var(--brand-500)] flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all active:scale-90"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-5 border-t border-(--border-subtle)">
          <button
            onClick={handleSubmit}
            className="btn-primary w-full flex items-center justify-between text-lg py-4 rounded-2xl"
          >
            <span>{isEditMode ? 'Update Item' : 'Add to Cart'}</span>
            <span className="font-bold">{formatCurrency(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
