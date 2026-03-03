'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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
  price: number;
  isAvailable: boolean;
  isBestSeller: boolean;
  isRecommended: boolean;
  category: { name: string };
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

  useEffect(() => {
    const auth = localStorage.getItem('admin_auth');
    if (!auth) {
      router.push('/admin');
      return;
    }
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, menuRes] = await Promise.all([
        fetch('/api/orders?today=true'),
        fetch('/api/menu'),
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
                    ? 'bg-linear-to-r from-coffee-500/20 to-amber-600/20 text-(--text-primary) border border-coffee-500/30'
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
              <div className="w-12 h-12 border-4 border-coffee-500 border-t-transparent rounded-full animate-spin" />
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
                            <span className="w-6 h-6 rounded-full bg-coffee-700 flex items-center justify-center text-xs text-coffee-200">
                              {index + 1}
                            </span>
                            <span className="flex-1 text-(--text-primary)">{name}</span>
                            <span className="text-sm text-(--text-muted)">{count} sold</span>
                            <div className="w-24 h-2 rounded-full bg-coffee-800 overflow-hidden">
                              <div
                                className="h-full bg-linear-to-r from-coffee-500 to-amber-500 rounded-full"
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
                    <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>

                  <div className="glass-card overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-(--border-subtle)">
                          <th className="text-left p-4 text-sm text-(--text-muted) font-medium">Item</th>
                          <th className="text-left p-4 text-sm text-(--text-muted) font-medium">Category</th>
                          <th className="text-left p-4 text-sm text-(--text-muted) font-medium">Price</th>
                          <th className="text-left p-4 text-sm text-(--text-muted) font-medium">Tags</th>
                          <th className="text-center p-4 text-sm text-(--text-muted) font-medium">Available</th>
                        </tr>
                      </thead>
                      <tbody>
                        {menuItems.map((item) => (
                          <tr key={item.id} className="border-b border-(--border-subtle) hover:bg-(--bg-card-hover) transition-colors">
                            <td className="p-4">
                              <span className="font-medium text-(--text-primary)">{item.name}</span>
                            </td>
                            <td className="p-4 text-sm text-(--text-secondary)">{item.category.name}</td>
                            <td className="p-4 text-sm text-(--text-primary) font-medium">{formatCurrency(item.price)}</td>
                            <td className="p-4">
                              <div className="flex gap-1">
                                {item.isBestSeller && <span className="badge badge-best-seller text-[10px]">Best Seller</span>}
                                {item.isRecommended && <span className="badge badge-recommended text-[10px]">Recommended</span>}
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => toggleAvailability(item.id, item.isAvailable)}
                                className={`w-12 h-7 rounded-full transition-all flex items-center px-1 ${
                                  item.isAvailable ? 'bg-green-500' : 'bg-coffee-800'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                  item.isAvailable ? 'translate-x-5' : 'translate-x-0'
                                }`} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                              <span key={item.id} className="text-xs px-2 py-1 rounded-full bg-coffee-800/50 text-coffee-300">
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
