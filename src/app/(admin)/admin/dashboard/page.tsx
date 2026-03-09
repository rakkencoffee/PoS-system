'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import MenuFormModal from '@/components/admin/MenuFormModal';

interface OrderData {
  id: number;
  queueNumber: number;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  items: {
    id: number;
    menuItem: { name: string };
    quantity: number;
  }[];
}

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  categoryId: number;
  type: string;
  isAvailable: boolean;
  isBestSeller: boolean;
  isRecommended: boolean;
  category: { name: string };
  sizes?: { size: string; priceAdjustment: number }[];
}

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

type Tab = 'overview' | 'menu' | 'orders';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const auth = localStorage.getItem('admin_auth');
    if (!auth) {
      router.push('/admin');
      return;
    }
  }, [router]);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, menuRes] = await Promise.all([
        fetch('/api/orders?today=true'),
        fetch('/api/admin/menu'),
      ]);
      const ordersData = await ordersRes.json();
      const menuData = await menuRes.json();
      setOrders(ordersData);
      setMenuItems(menuData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const todayRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED').length;
  const activeOrders = orders.filter((o) => o.status !== 'COMPLETED').length;

  // Best sellers from today's orders
  const itemCounts: Record<string, number> = {};
  orders.forEach((o) => {
    o.items.forEach((item) => {
      itemCounts[item.menuItem.name] = (itemCounts[item.menuItem.name] || 0) + item.quantity;
    });
  });
  const bestSellers = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const tabs = [
    { key: 'overview' as Tab, label: 'Overview', icon: '📊' },
    { key: 'menu' as Tab, label: 'Menu', icon: '📋' },
    { key: 'orders' as Tab, label: 'Orders', icon: '🧾' },
  ];

  const toggleAvailability = async (itemId: number, isAvailable: boolean) => {
    try {
      await fetch(`/api/menu/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !isAvailable }),
      });
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, isAvailable: !isAvailable } : item
        )
      );
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDelete = async (item: MenuItem) => {
    try {
      await fetch(`/api/menu/${item.id}`, { method: 'DELETE' });
      setMenuItems((prev) => prev.filter((m) => m.id !== item.id));
      setDeletingItem(null);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    router.push('/admin');
  };

  return (
    <div className="min-h-screen">
      {/* Sidebar + Content */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen glass border-r border-(--border-subtle) p-6 flex flex-col">
          <div className="mb-8">
            <h1 className="text-xl font-bold text-gradient">StartFriday</h1>
            <p className="text-xs text-(--text-muted)">Admin Dashboard</p>
          </div>

          <nav className="space-y-2 flex-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  activeTab === tab.key
                    ? 'bg-linear-to-r from-[#A8131E]/20 to-[#8B0F19]/20 text-(--text-primary) border border-[#A8131E]/30'
                    : 'text-(--text-secondary) hover:bg-(--bg-card)'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="space-y-2">
            <a href="/kitchen" target="_blank" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-(--text-secondary) hover:bg-(--bg-card) transition-all">
              <span>🖥️</span>
              <span className="font-medium text-sm">Open KDS</span>
            </a>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
            >
              <span>🚪</span>
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-[#A8131E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold text-(--text-primary) mb-6">Today&apos;s Overview</h2>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="glass-card p-5">
                      <p className="text-sm text-(--text-muted) mb-1">Today&apos;s Revenue</p>
                      <p className="text-2xl font-bold text-gradient">{formatCurrency(todayRevenue)}</p>
                    </div>
                    <div className="glass-card p-5">
                      <p className="text-sm text-(--text-muted) mb-1">Total Orders</p>
                      <p className="text-2xl font-bold text-(--text-primary)">{orders.length}</p>
                    </div>
                    <div className="glass-card p-5">
                      <p className="text-sm text-(--text-muted) mb-1">Completed</p>
                      <p className="text-2xl font-bold text-green-400">{completedOrders}</p>
                    </div>
                    <div className="glass-card p-5">
                      <p className="text-sm text-(--text-muted) mb-1">Active</p>
                      <p className="text-2xl font-bold text-amber-400">{activeOrders}</p>
                    </div>
                  </div>

                  {/* Best Sellers */}
                  <div className="glass-card p-6 mb-8">
                    <h3 className="text-lg font-semibold text-(--text-primary) mb-4">🔥 Best Sellers Today</h3>
                    {bestSellers.length === 0 ? (
                      <p className="text-(--text-muted)">No orders yet today</p>
                    ) : (
                      <div className="space-y-3">
                        {bestSellers.map(([name, count], index) => (
                          <div key={name} className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#A8131E] flex items-center justify-center text-xs text-white">
                              {index + 1}
                            </span>
                            <span className="flex-1 text-(--text-primary)">{name}</span>
                            <span className="text-sm text-(--text-muted)">{count} sold</span>
                            <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-linear-to-r from-[#A8131E] to-[#c41525] rounded-full"
                                style={{ width: `${(count / bestSellers[0][1]) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payment Methods */}
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-(--text-primary) mb-4">💳 Payment Methods</h3>
                    {(() => {
                      const methods: Record<string, number> = {};
                      orders.forEach((o) => {
                        methods[o.paymentMethod] = (methods[o.paymentMethod] || 0) + 1;
                      });
                      return Object.entries(methods).length === 0 ? (
                        <p className="text-(--text-muted)">No data yet</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {Object.entries(methods).map(([method, count]) => (
                            <div key={method} className="bg-(--bg-card) rounded-xl p-4 text-center">
                              <p className="text-2xl font-bold text-(--text-primary)">{count}</p>
                              <p className="text-xs text-(--text-muted) mt-1">{method}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Menu Tab */}
              {activeTab === 'menu' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-(--text-primary)">Menu Management</h2>
                    <div className="flex gap-3">
                      <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                      <button
                        onClick={() => { setEditingItem(null); setShowMenuModal(true); }}
                        className="btn-primary flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Menu Item
                      </button>
                    </div>
                  </div>

                  {/* Search & Category Filter */}
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="relative">
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search menu by name or description..."
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-(--bg-card) border border-(--border-subtle) text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:border-[#A8131E] transition-colors"
                      />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      <button
                        onClick={() => setMenuCategoryFilter('all')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                          menuCategoryFilter === 'all'
                            ? 'bg-linear-to-r from-[#c41525] to-[#A8131E] text-white shadow-md'
                            : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle) hover:border-(--border-default)'
                        }`}
                      >
                        🍽️ All ({menuItems.length})
                      </button>
                      {categories.map((cat) => {
                        const count = menuItems.filter((m) => m.category.name === cat.name).length;
                        return (
                          <button
                            key={cat.slug}
                            onClick={() => setMenuCategoryFilter(cat.name)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                              menuCategoryFilter === cat.name
                                ? 'bg-linear-to-r from-[#c41525] to-[#A8131E] text-white shadow-md'
                                : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle) hover:border-(--border-default)'
                            }`}
                          >
                            {cat.icon} {cat.name} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="glass-card overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-(--border-subtle)">
                          <th className="text-left p-4 text-sm text-(--text-muted) font-medium">Item</th>
                          <th className="text-left p-4 text-sm text-(--text-muted) font-medium">Category</th>
                          <th className="text-left p-4 text-sm text-(--text-muted) font-medium">Price</th>
                          <th className="text-left p-4 text-sm text-(--text-muted) font-medium">Tags / Variants</th>
                          <th className="text-center p-4 text-sm text-(--text-muted) font-medium">Available</th>
                          <th className="text-center p-4 text-sm text-(--text-muted) font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {menuItems
                          .filter((item) => {
                            const matchSearch = menuSearch === '' ||
                              item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                              item.description.toLowerCase().includes(menuSearch.toLowerCase());
                            const matchCategory = menuCategoryFilter === 'all' ||
                              item.category.name === menuCategoryFilter;
                            return matchSearch && matchCategory;
                          })
                          .map((item) => (
                          <tr key={item.id} className={`border-b border-(--border-subtle) hover:bg-(--bg-card-hover) transition-colors ${!item.isAvailable ? 'opacity-50' : ''}`}>
                            <td className="p-4">
                              <span className="font-medium text-(--text-primary)">{item.name}</span>
                              {item.description && (
                                <p className="text-xs text-(--text-muted) mt-0.5 max-w-[200px] truncate">{item.description}</p>
                              )}
                            </td>
                            <td className="p-4 text-sm text-(--text-secondary)">{item.category.name}</td>
                            <td className="p-4 text-sm text-(--text-primary) font-medium">{formatCurrency(item.price)}</td>
                            <td className="p-4">
                              <div className="flex gap-1 flex-wrap">
                                {item.isBestSeller && <span className="badge badge-best-seller text-[10px]">Best Seller</span>}
                                {item.isRecommended && <span className="badge badge-recommended text-[10px]">Recommended</span>}
                                {item.type !== 'none' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                                    {item.type === 'hot' ? '🔥' : item.type === 'iced' ? '🧊' : '☕'} {item.type}
                                  </span>
                                )}
                                {item.sizes && item.sizes.length > 0 && (
                                  <div className="flex gap-0.5">
                                    {item.sizes.map((s: { size: string; priceAdjustment: number }) => (
                                      <span key={s.size} className="text-[10px] px-1.5 py-0.5 rounded bg-[#A8131E]/20 text-[#ff6b6b]">
                                        {s.size === 'Hot' ? '🔥' : s.size === 'Ice' ? '🧊' : '⬆️'}{s.size}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => toggleAvailability(item.id, item.isAvailable)}
                                className={`w-12 h-7 rounded-full transition-all flex items-center px-1 mx-auto ${
                                  item.isAvailable ? 'bg-green-500' : 'bg-white/10'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                  item.isAvailable ? 'translate-x-5' : 'translate-x-0'
                                }`} />
                              </button>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => { setEditingItem(item); setShowMenuModal(true); }}
                                  className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-muted) hover:text-(--text-primary) transition-all"
                                  title="Edit"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setDeletingItem(item)}
                                  className="p-2 rounded-lg hover:bg-red-500/10 text-(--text-muted) hover:text-red-400 transition-all"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Menu Form Modal */}
                  <MenuFormModal
                    isOpen={showMenuModal}
                    onClose={() => { setShowMenuModal(false); setEditingItem(null); }}
                    onSave={fetchData}
                    editItem={editingItem}
                  />

                  {/* Delete Confirmation */}
                  {deletingItem && createPortal(
                    <div className="fixed inset-0 z-9999 flex items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeletingItem(null)} />
                      <div className="relative glass-card p-6 max-w-sm mx-4 text-center animate-scale-in">
                        <span className="text-4xl mb-4 block">🗑️</span>
                        <h3 className="text-lg font-bold text-(--text-primary) mb-2">Delete {deletingItem.name}?</h3>
                        <p className="text-sm text-(--text-muted) mb-6">This action cannot be undone. The item will be permanently removed.</p>
                        <div className="flex gap-3">
                          <button onClick={() => setDeletingItem(null)} className="flex-1 btn-secondary py-2.5">
                            Cancel
                          </button>
                          <button onClick={() => handleDelete(deletingItem)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-all">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold text-(--text-primary) mb-6">Today&apos;s Orders</h2>

                  <div className="space-y-3">
                    {orders.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-(--text-muted)">No orders today</p>
                      </div>
                    ) : (
                      orders.map((order) => (
                        <div key={order.id} className="glass-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-gradient">#{order.queueNumber}</span>
                              <span className={`badge text-[10px] ${
                                order.status === 'PENDING' ? 'badge-status-pending' :
                                order.status === 'PREPARING' ? 'badge-status-preparing' :
                                order.status === 'READY' ? 'badge-status-ready' :
                                'bg-gray-500/15 text-gray-400'
                              }`}>
                                {order.status}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-(--text-primary)">{formatCurrency(order.totalAmount)}</p>
                              <p className="text-xs text-(--text-muted)">
                                {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                {' • '}{order.paymentMethod}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {order.items.map((item) => (
                              <span key={item.id} className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/70">
                                {item.quantity}x {item.menuItem.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
