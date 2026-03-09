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

const defaultForm: MenuFormData = {
  name: '',
  description: '',
  price: 0,
  categoryId: 0,
  type: 'both',
  isAvailable: true,
  isBestSeller: false,
  isRecommended: false,
  sizes: [
    { size: 'S', priceAdjustment: -5000 },
    { size: 'M', priceAdjustment: 0 },
    { size: 'L', priceAdjustment: 5000 },
  ],
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
      setForm({
        name: editItem.name,
        description: editItem.description,
        price: editItem.price,
        categoryId: editItem.categoryId,
        type: editItem.type,
        isAvailable: editItem.isAvailable,
        isBestSeller: editItem.isBestSeller,
        isRecommended: editItem.isRecommended,
        sizes: editItem.sizes?.length
          ? editItem.sizes.map((s) => ({ size: s.size, priceAdjustment: s.priceAdjustment }))
          : defaultForm.sizes,
      });
    } else {
      setForm(defaultForm);
    }
  }, [editItem, isOpen]);

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

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  const updateSize = (index: number, field: keyof SizeInput, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
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

          {/* Type */}
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

          {/* Sizes */}
          <div>
            <label className="block text-sm text-(--text-secondary) mb-2">Size Pricing</label>
            <div className="grid grid-cols-3 gap-3">
              {form.sizes.map((size, i) => (
                <div key={size.size} className="bg-(--bg-card) border border-(--border-subtle) rounded-xl p-3 text-center">
                  <span className="text-lg font-bold text-(--text-primary)">{size.size}</span>
                  <input
                    type="number"
                    value={size.priceAdjustment}
                    onChange={(e) => updateSize(i, 'priceAdjustment', Number(e.target.value))}
                    className="w-full mt-2 px-2 py-1.5 rounded-lg bg-black/20 border border-(--border-subtle) text-(--text-primary) text-center text-sm focus:outline-none"
                  />
                  <span className="text-[10px] text-(--text-muted) mt-1 block">adjustment (Rp)</span>
                </div>
              ))}
            </div>
          </div>

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
