'use client';

interface MenuItemSize {
  id: number;
  size: string;
  priceAdjustment: number;
}

interface MenuCardProps {
  item: {
    id: number;
    name: string;
    description: string;
    price: number;
    image: string;
    isBestSeller: boolean;
    isRecommended: boolean;
    type: string;
    sizes: MenuItemSize[];
  };
  index: number;
  onSelect: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function MenuCard({ item, index, onSelect }: MenuCardProps) {
  const typeIcons: Record<string, string> = {
    hot: '🔴',
    iced: '🧊',
    both: '🔴🧊',
  };

  return (
    <button
      onClick={onSelect}
      className="glass-card text-left overflow-hidden group animate-fade-in"
      style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}
    >
      {/* Image area */}
      <div className="relative h-36 bg-gradient-to-br from-coffee-800/50 to-coffee-900/50 flex items-center justify-center overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <span className="text-5xl opacity-50 group-hover:scale-110 transition-transform duration-500">
            ☕
          </span>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {item.isBestSeller && (
            <span className="badge badge-best-seller text-[10px]">🔥 Best Seller</span>
          )}
          {item.isRecommended && (
            <span className="badge badge-recommended text-[10px]">⭐ Recommended</span>
          )}
        </div>

        {/* Type indicator */}
        <span className="absolute top-2 right-2 text-sm">
          {typeIcons[item.type]}
        </span>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-[var(--text-primary)] text-sm leading-tight mb-1 line-clamp-1">
          {item.name}
        </h3>
        <p className="text-[var(--text-muted)] text-xs line-clamp-2 mb-3 min-h-[2rem]">
          {item.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-coffee-300 font-bold text-sm">
            {formatCurrency(item.price)}
          </span>
          <span className="w-8 h-8 rounded-full bg-gradient-to-r from-coffee-500 to-amber-600 flex items-center justify-center text-white text-lg leading-none group-hover:scale-110 transition-transform">
            +
          </span>
        </div>
      </div>
    </button>
  );
}
