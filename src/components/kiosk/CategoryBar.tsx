'use client';

interface Category {
  id: number | string;
  name: string;
  slug: string;
  icon: string;
}

interface CategoryBarProps {
  categories: Category[];
  selected: string;
  onSelect: (slug: string) => void;
}

export default function CategoryBar({ categories, selected, onSelect }: CategoryBarProps) {
  const allCategories = [
    { id: 0, name: 'All', slug: 'all', icon: '🍽️' },
    ...categories,
  ];

  return (
    <div className="px-6 mb-4 max-w-7xl mx-auto w-full">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {allCategories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => onSelect(cat.slug)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
              selected === cat.slug
                ? 'bg-linear-to-r from-[#c41525] to-[#A8131E] text-white shadow-lg shadow-red-900/30 scale-105'
                : 'glass-card rounded-2xl! hover:bg-(--bg-card-hover)!'
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
