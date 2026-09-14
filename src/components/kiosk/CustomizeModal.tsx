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
    addOns?: { id: number; name: string; price: number }[];
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

// Coffee bean flavor -- a real Olsera variant dimension, baked into the
// variant name as its trailing comma segment (e.g. "Hot,Small,Bold & Nutty").
// Order here also drives display order and the default ("Roar", no add-on).
const BEAN_FLAVORS = ['Roar', 'Bold & Nutty', 'Rich & Fruity'];

function matchBeanFlavor(segment: string): string | null {
  const trimmed = segment.trim();
  return BEAN_FLAVORS.find((b) => b.toLowerCase() === trimmed.toLowerCase()) || null;
}

// Which Sugar/Ice levels apply per item -- these stay kiosk-only (free, not
// Olsera data), but unlike Milk/Beans/Shot the exact set of levels genuinely
// varies per item (e.g. Kyoto Origin only offers No Sugar/Add Sugar, not
// Less/Normal), so a flat "show whole section y/n" flag isn't enough anymore.
// Ice is capped store-wide to 2 levels (Less/Normal) -- No Ice/More Ice were
// dropped from the menu entirely. Keys reference sugarLevels/iceLevels below.
const SUGAR_ICE_CONFIG: Record<string, { sugar: string[]; ice: string[] }> = {
  'kyoto origin': { sugar: ['none', 'more'], ice: ['less', 'normal'] },
  'kyoto house blend': { sugar: ['none', 'less', 'normal'], ice: ['less', 'normal'] },
  'kyoto sakura latte': { sugar: ['none', 'less', 'normal'], ice: ['less', 'normal'] },
  'yuzu coffee': { sugar: ['none', 'less', 'normal'], ice: ['less', 'normal'] },
  'dirty matcha': { sugar: ['none', 'less', 'normal'], ice: ['less', 'normal'] },
  'rakken house blend': { sugar: ['none', 'less', 'normal'], ice: ['less', 'normal'] },
  'cafe latte': { sugar: ['none', 'more'], ice: ['less', 'normal'] },
  'café latte': { sugar: ['none', 'more'], ice: ['less', 'normal'] },
  'cappuccino': { sugar: ['none', 'more'], ice: [] },
  'long black': { sugar: ['none', 'more'], ice: ['less', 'normal'] },
  'kokuto latte': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'coconut coffee': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'sea salt caramel latte': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'butterscotch cloud coffee': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'kakao coffee shakerato': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'kakao coffee shakareto': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'peach coffee shakerato': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'mocha coffee cloud': { sugar: ['less', 'normal'], ice: [] },
  'uji matcha latte': { sugar: [], ice: ['less', 'normal'] },
  'matchakura cloud latte': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'kokuto matcha latte': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'matcha berry latte': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'kuro kakao': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'rakken milk tea': { sugar: ['less', 'normal'], ice: [] },
  'peach milk tea shakerato': { sugar: ['less', 'normal'], ice: [] },
  'peach milk tea shakareto': { sugar: ['less', 'normal'], ice: [] },
  'jasmine green tea': { sugar: ['none', 'less', 'normal'], ice: ['less', 'normal'] },
  'lemon black tea': { sugar: ['none', 'less', 'normal'], ice: ['less', 'normal'] },
  'blueberry mint tea': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'yakult frizz': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
  'sunset in kyoto': { sugar: ['less', 'normal'], ice: ['less', 'normal'] },
};

const FOOD_CATEGORIES = ['dessert', 'snack', 'main-course', 'bites'];

// Unmapped items (new drinks not yet in the table above) fall back to the
// full set rather than silently hiding Sugar/Ice -- food items get neither.
function getSugarIceConfig(itemName: string, categorySlug: string): { sugar: string[]; ice: string[] } {
  if (FOOD_CATEGORIES.includes(categorySlug)) return { sugar: [], ice: [] };
  const found = SUGAR_ICE_CONFIG[itemName.toLowerCase().trim()];
  return found || { sugar: ['none', 'less', 'normal', 'more'], ice: ['less', 'normal'] };
}

// Olsera Add-On names, categorized so the right ones render in the right
// section. Anything not listed here is ignored (fail-safe against unrelated
// future add-ons showing up in the wrong spot).
const MILK_ADDON_NAMES = ['Oat Milk'];
const BEAN_ADDON_NAMES = ['Roar 50', 'Arabica Blend', 'Exotic Blend'];
const SHOT_ADDON_NAMES = ['Extra Shot'];

export default function CustomizeModal({ item, onClose, editingCartItem }: CustomizeModalProps) {
  const { addItem, updateItem } = useCartStore();
  const isEditMode = !!editingCartItem;

  // Parse existing toppings from editingCartItem to recover milk/beans/shot state
  const parsedEdit = (() => {
    if (!editingCartItem) return null;
    let milk = 'dairy';
    let beans = 'rakken-blend';
    let shot = 'normal';
    for (const t of editingCartItem.toppings) {
      const tid = String(t.id);
      if (tid.startsWith('milk-')) { milk = tid.replace('milk-', ''); }
      else if (tid.startsWith('beans-')) { beans = tid.replace('beans-', ''); }
      else if (tid.startsWith('shot-')) { shot = tid.replace('shot-', ''); }
    }
    return { milk, beans, shot };
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

  const slug = item.category?.slug || item.categorySlug || '';
  const sugarIceCfg = getSugarIceConfig(item.name as string, slug);

  // Olsera Add-Ons applicable to this item, split into the 3 kiosk sections
  // that read from them. Beans choices come straight from Olsera (Roar 50 /
  // Exotic Blend are already Rp0 entries there, so no synthetic "default"
  // needed) -- Milk and Shot each get a free/no-charge default choice added
  // locally since "Dairy Milk"/"Normal Shot" aren't Olsera add-ons themselves.
  const itemAddOns = item.addOns || [];
  const beansChoices = itemAddOns
    .filter((a) => BEAN_ADDON_NAMES.includes(a.name))
    .map((a) => ({ key: `addon-${a.id}`, label: a.name, sub: '', price: a.price }))
    .sort((a, b) => a.price - b.price);
  const milkAddOns = itemAddOns.filter((a) => MILK_ADDON_NAMES.includes(a.name));
  const milkChoices = milkAddOns.length > 0
    ? [
        { key: 'dairy', label: 'Dairy Milk', sub: 'Susu standar', price: 0 },
        ...milkAddOns.map((a) => ({ key: `addon-${a.id}`, label: a.name, sub: 'Plant-based', price: a.price })),
      ]
    : [];
  const shotAddOns = itemAddOns.filter((a) => SHOT_ADDON_NAMES.includes(a.name));
  const shotChoices = shotAddOns.length > 0
    ? [
        { key: 'normal', label: 'Normal Shot', sub: 'Standar recipe', price: 0 },
        ...shotAddOns.map((a) => ({ key: `addon-${a.id}`, label: a.name, sub: '+1 shot', price: a.price })),
      ]
    : [];

  const sugarLevelsAll = [
    { key: 'none', label: 'No Sugar', sub: 'Tanpa gula/syrup' },
    { key: 'less', label: 'Less Sugar', sub: 'gula 70%' },
    { key: 'normal', label: 'Normal Sugar', sub: 'Standar penyajian' },
    { key: 'more', label: 'More Sugar', sub: 'gula 130%' },
  ];
  const iceLevelsAll = [
    { key: 'less', label: 'Less Ice', sub: 'es 70%' },
    { key: 'normal', label: 'Normal Ice', sub: 'Standar penyajian' },
  ];
  const sugarLevels = sugarLevelsAll.filter((l) => sugarIceCfg.sugar.includes(l.key));
  const iceLevels = iceLevelsAll.filter((l) => sugarIceCfg.ice.includes(l.key));

  const [selectedSize, setSelectedSize] = useState(
    editingCartItem?.size ? stripBeanSuffix(editingCartItem.size) : ''
  );
  const [selectedBeanFlavor, setSelectedBeanFlavor] = useState<string>(() => {
    if (!editingCartItem) return BEAN_FLAVORS[0];
    const segments = editingCartItem.size.split(',').map((s) => s.trim());
    return matchBeanFlavor(segments[segments.length - 1]) || BEAN_FLAVORS[0];
  });
  const [sugarLevel, setSugarLevel] = useState(
    editingCartItem?.sugarLevel || (sugarLevels.find((l) => l.key === 'normal') ?? sugarLevels[0])?.key || ''
  );
  const [iceLevel, setIceLevel] = useState(
    editingCartItem?.iceLevel || (iceLevels.find((l) => l.key === 'normal') ?? iceLevels[0])?.key || ''
  );
  const [milkChoice, setMilkChoice] = useState(parsedEdit?.milk || milkChoices[0]?.key || 'dairy');
  const [beansChoice, setBeansChoice] = useState(parsedEdit?.beans || beansChoices[0]?.key || '');
  const [shotChoice, setShotChoice] = useState(parsedEdit?.shot || shotChoices[0]?.key || 'normal');
  const [quantity, setQuantity] = useState(editingCartItem?.quantity || 1);

  // Hot drinks can't physically have an Ice Level -- whenever the selected
  // variant's temp segment (the part before the first comma, e.g.
  // "Hot,Small") is "Hot", lock the Ice Level addon out entirely instead of
  // just hiding it, so a stale selection never sneaks into the cart.
  const isHotSelected = (selectedSize.split(',')[0] || '').trim().toLowerCase() === 'hot';
  const showIceLevel = iceLevels.length > 0 && !isHotSelected;

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

  const isFood = slug ? FOOD_CATEGORIES.includes(slug) : item.type === 'none';
  const isDrink = !isFood;

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

  const selectedMilkPrice = milkChoices.find(m => m.key === milkChoice)?.price || 0;
  const selectedBeansPrice = beansChoices.find(b => b.key === beansChoice)?.price || 0;
  const selectedShotPrice = shotChoices.find(s => s.key === shotChoice)?.price || 0;

  // The exact combo currently picked (base variant + bean flavor), when this
  // item has a bean dimension -- this is what actually gets billed/synced to
  // Olsera, since bean flavor changes the price.
  const selectedBeanVariant = beanVariantInfo?.parsed.find(
    (p) => p.baseKey === selectedSize && p.bean === selectedBeanFlavor
  );

  const sizeAdjustment = beanVariantInfo
    ? (selectedBeanVariant?.variant.price ?? item.price) - item.price
    : displaySizes.find((s) => s.size === selectedSize)?.priceAdjustment || 0;

  const unitPrice = item.price + sizeAdjustment + selectedMilkPrice + selectedBeansPrice + selectedShotPrice;
  const totalPrice = unitPrice * quantity;

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

    const finalToppings: Topping[] = [];

    if (milkChoices.length > 0 && milkChoice !== 'dairy') {
      const selectedMilk = milkChoices.find(m => m.key === milkChoice);
      if (selectedMilk) finalToppings.push({ id: `milk-${selectedMilk.key}` as any, name: selectedMilk.label, price: selectedMilk.price });
    }
    if (beansChoices.length > 0 && beansChoice !== beansChoices[0]?.key) {
      const selectedBeans = beansChoices.find(b => b.key === beansChoice);
      if (selectedBeans) finalToppings.push({ id: `beans-${selectedBeans.key}` as any, name: selectedBeans.label, price: selectedBeans.price });
    }
    if (shotChoices.length > 0 && shotChoice !== 'normal') {
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
      sugarLevel: sugarLevels.length > 0 ? sugarLevel : '',
      iceLevel: showIceLevel ? iceLevel : '',
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
          {sugarLevels.length > 0 && (
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

          {/* Ice Level -- hidden when a Hot variant is selected (see isHotSelected) */}
          {showIceLevel && (
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
          {beansChoices.length > 0 && (
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
                    {bean.price > 0 && <span className="text-xs font-bold mt-1">+{formatCurrency(bean.price)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Coffee Shot */}
          {shotChoices.length > 0 && (
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
          {milkChoices.length > 0 && (
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
