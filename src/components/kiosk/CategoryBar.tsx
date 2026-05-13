'use client';

interface Category {
  id: number | string;
  name: string;
  slug: string;
  icon?: string;
}

interface CategoryBarProps {
  categories: Category[];
  selected: string;
  onSelect: (slug: string) => void;
}

export default function CategoryBar({ categories, selected, onSelect }: CategoryBarProps) {
  return (
    <div className="w-full">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-6 max-w-7xl mx-auto">
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => onSelect(cat.slug)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
              selected === cat.slug
                ? 'bg-[var(--brand-500)] text-white shadow-lg shadow-red-900/30 scale-105'
                : 'bg-(--bg-card) text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-card-hover) border border-(--border-subtle) hover:-translate-y-1 hover:shadow-md'
            }`}
          >
            <span className="text-lg">{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
