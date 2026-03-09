'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface SizeInput {
  size: string;
  priceAdjustment: number;
  enabled: boolean;
}

interface MenuFormData {
  name: string;
  description: string;
  price: number;
  categoryId: number;
  type: string;
  isAvailable: boolean;
  isBestSeller: boolean;
  isRecommended: boolean;
  sizes: SizeInput[];
}

interface MenuFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editItem?: {
    id: number;
    name: string;
    description: string;
    price: number;
    categoryId: number;
    type: string;
    isAvailable: boolean;
    isBestSeller: boolean;
    isRecommended: boolean;
    sizes?: { size: string; priceAdjustment: number }[];
  } | null;
}

// Food categories that don't need type/size options
const FOOD_SLUGS = ['dessert', 'snack', 'main-course'];

const defaultDrinkSizes: SizeInput[] = [
  { size: 'Hot', priceAdjustment: 0, enabled: true },
  { size: 'Ice', priceAdjustment: 2000, enabled: true },
  { size: 'Upsize', priceAdjustment: 5000, enabled: true },
];

const defaultForm: MenuFormData = {
  name: '',
  description: '',
  price: 0,
  categoryId: 0,
  type: 'both',
  isAvailable: true,
  isBestSeller: false,
  isRecommended: false,
  sizes: defaultDrinkSizes.map((s) => ({ ...s })),
};

export default function MenuFormModal({ isOpen, onClose, onSave, editItem }: MenuFormModalProps) {
  const [form, setForm] = useState<MenuFormData>(defaultForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (editItem) {
      // Build sizes: merge with defaults so all 3 are always shown
      const existingSizes = editItem.sizes || [];
      const sizes = defaultDrinkSizes.map((def) => {
        const existing = existingSizes.find((s) => s.size === def.size);
        return existing
          ? { size: existing.size, priceAdjustment: existing.priceAdjustment, enabled: true }
          : { ...def, enabled: false };
      });

      setForm({
        name: editItem.name,
        description: editItem.description,
        price: editItem.price,
        categoryId: editItem.categoryId,
        type: editItem.type,
        isAvailable: editItem.isAvailable,
        isBestSeller: editItem.isBestSeller,
        isRecommended: editItem.isRecommended,
        sizes,
      });
    } else {
      setForm(defaultForm);
    }
  }, [editItem, isOpen]);

  // Determine if selected category is food
  // Note: categories API may return string IDs, form.categoryId is number — compare as strings
  const selectedCategory = categories.find((c) => String(c.id) === String(form.categoryId));
  const isFood = selectedCategory ? FOOD_SLUGS.includes(selectedCategory.slug) : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.categoryId) {
      setError('Name, price, and category are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = editItem ? `/api/menu/${editItem.id}` : '/api/menu';
      const method = editItem ? 'PUT' : 'POST';

      // For food items: no type, no sizes
      const payload = {
        ...form,
        type: isFood ? 'none' : form.type,
        sizes: isFood ? [] : form.sizes.filter((s) => s.enabled).map(({ size, priceAdjustment }) => ({ size, priceAdjustment })),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');

      onSave();
      onClose();
    } catch {
      setError('Failed to save menu item');
    } finally {
      setSaving(false);
    }
  };

  const toggleSize = (index: number) => {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s)),
    }));
  };

  const updateSizePrice = (index: number, value: number) => {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.map((s, i) => (i === index ? { ...s, priceAdjustment: value } : s)),
    }));
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto animate-scale-in mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-(--text-primary)">
            {editItem ? 'Edit Menu Item' : 'Add Menu Item'}
          </h2>
          <button onClick={onClose} className="text-(--text-muted) hover:text-(--text-primary) text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-(--text-secondary) mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Cafe Latte"
              className="w-full px-4 py-2.5 rounded-xl bg-(--bg-card) border border-(--border-subtle) text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:border-[#A8131E]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-(--text-secondary) mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short description..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-(--bg-card) border border-(--border-subtle) text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:border-[#A8131E] resize-none"
            />
          </div>

          {/* Price + Category row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-(--text-secondary) mb-1">Base Price (Rp) *</label>
              <input
                type="number"
                value={form.price || ''}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                placeholder="28000"
                className="w-full px-4 py-2.5 rounded-xl bg-(--bg-card) border border-(--border-subtle) text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:border-[#A8131E]"
              />
            </div>
            <div>
              <label className="block text-sm text-(--text-secondary) mb-1">Category *</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl bg-(--bg-card) border border-(--border-subtle) text-(--text-primary) focus:outline-none focus:border-[#A8131E]"
              >
                <option value={0}>Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Type (drinks only) */}
          {!isFood && (
            <div>
              <label className="block text-sm text-(--text-secondary) mb-1">Type</label>
              <div className="flex gap-2">
                {['hot', 'iced', 'both'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      form.type === t
                        ? 'bg-linear-to-r from-[#c41525] to-[#A8131E] text-white'
                        : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle)'
                    }`}
                  >
                    {t === 'hot' ? '🔥 Hot' : t === 'iced' ? '🧊 Iced' : '☕ Both'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Variant Pricing (drinks only: Hot / Ice / Upsize) */}
          {!isFood && (
            <div>
              <label className="block text-sm text-(--text-secondary) mb-2">Variant Pricing (Hot / Ice / Upsize)</label>
              <div className="grid grid-cols-3 gap-3">
                {form.sizes.map((size, i) => (
                  <div key={size.size} className={`rounded-xl p-3 text-center transition-all ${
                    size.enabled
                      ? 'bg-(--bg-card) border border-(--border-subtle)'
                      : 'bg-(--bg-card)/30 border border-transparent opacity-50'
                  }`}>
                    <button
                      type="button"
                      onClick={() => toggleSize(i)}
                      className={`w-full text-lg font-bold mb-1 ${
                        size.enabled ? 'text-(--text-primary)' : 'text-(--text-muted)'
                      }`}
                    >
                      {size.size === 'Hot' ? '🔥' : size.size === 'Ice' ? '🧊' : '⬆️'} {size.size}
                    </button>
                    <div className={`flex items-center gap-1 justify-center mb-1 ${!size.enabled ? 'pointer-events-none' : ''}`}>
                      <input
                        type="checkbox"
                        checked={size.enabled}
                        onChange={() => toggleSize(i)}
                        className="accent-[#A8131E]"
                      />
                      <span className="text-xs text-(--text-muted)">Active</span>
                    </div>
                    {size.enabled && (
                      <>
                        <input
                          type="number"
                          value={size.priceAdjustment}
                          onChange={(e) => updateSizePrice(i, Number(e.target.value))}
                          className="w-full mt-1 px-2 py-1.5 rounded-lg bg-black/20 border border-(--border-subtle) text-(--text-primary) text-center text-sm focus:outline-none"
                        />
                        <span className="text-[10px] text-(--text-muted) mt-1 block">adjustment (Rp)</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info for food categories */}
          {isFood && (
            <div className="bg-(--bg-card) border border-(--border-subtle) rounded-xl p-3 text-center">
              <p className="text-sm text-(--text-muted)">
                🍽️ Food items don&apos;t have type or size variants
              </p>
            </div>
          )}

          {/* Toggles */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'isAvailable' as const, label: 'Available', color: 'green' },
              { key: 'isBestSeller' as const, label: 'Best Seller', color: 'amber' },
              { key: 'isRecommended' as const, label: 'Recommended', color: 'blue' },
            ].map((toggle) => (
              <button
                key={toggle.key}
                type="button"
                onClick={() => setForm({ ...form, [toggle.key]: !form[toggle.key] })}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  form[toggle.key]
                    ? `bg-${toggle.color}-500/15 border-${toggle.color}-500/40 text-${toggle.color}-400`
                    : 'bg-(--bg-card) border-(--border-subtle) text-(--text-muted)'
                }`}
              >
                {form[toggle.key] ? '✓ ' : ''}{toggle.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary py-3">
              {saving ? 'Saving...' : editItem ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
