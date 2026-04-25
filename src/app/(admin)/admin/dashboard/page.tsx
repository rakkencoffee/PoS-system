'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  TrendingUp, 
  ShoppingBag, 
  Coffee, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCcw 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

// Metric Card Component
function StatCard({ title, value, icon: Icon, trend, subValue, color }: any) {
  return (
    <div className="glass-card p-6 relative overflow-hidden group">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 group-hover:scale-110 transition-transform ${color}`} />
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/60">{title}</p>
          <h3 className="text-3xl font-black text-white">{value}</h3>
          <div className="flex items-center gap-2 mt-2">
            {trend > 0 ? (
              <span className="flex items-center text-emerald-400 text-xs font-bold">
                <ArrowUpRight className="w-3 h-3 mr-1" /> +{trend}%
              </span>
            ) : (
              <span className="flex items-center text-red-400 text-xs font-bold">
                <ArrowDownRight className="w-3 h-3 mr-1" /> {trend}%
              </span>
            )}
            <span className="text-white/30 text-[10px] uppercase tracking-tighter">{subValue}</span>
          </div>
        </div>
        <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 ${color.replace('bg-', 'text-')}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'reports', 'sales'],
    queryFn: async () => {
      const res = await fetch('/api/admin/reports/sales?period=today');
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json();
    },
    refetchInterval: 300000, // Auto-refetch every 5 mins as fallback
  });

  // Pusher Real-time Listener
  useEffect(() => {
    let channel: any = null;
    
    async function initPusher() {
      const { getPusherClient } = await import('@/lib/pusher');
      const pusher = getPusherClient();
      channel = pusher.subscribe('admin-reports');
      
      channel.bind('SALES_UPDATED', () => {
        console.log('[Dashboard] Sales updated, refetching...');
        queryClient.invalidateQueries({ queryKey: ['admin', 'reports', 'sales'] });
      });
    }

    initPusher();
    return () => {
      if (channel) {
        channel.unbind_all();
        channel.unsubscribe();
      }
    };
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 font-medium animate-pulse">Gathering real-time insights...</p>
        </div>
      </div>
    );
  }

  const COLORS = ['#A8131E', '#dc2626', '#ef4444', '#f87171', '#fca5a5'];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">SALES DASHBOARD</h1>
          <p className="text-white/40 text-sm mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live data from Rakken Coffee Kiosk
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary flex items-center gap-2 py-3 px-5 rounded-xl border-white/5 bg-white/5 hover:bg-white/10"
          >
            <RefreshCcw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Syncing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="TOTAL REVENUE" 
          value={`Rp ${data.totalRevenue?.toLocaleString('id-ID')}`}
          icon={TrendingUp}
          trend={12.5}
          subValue="vs yesterday"
          color="bg-emerald-500"
        />
        <StatCard 
          title="TOTAL ORDERS" 
          value={data.totalOrders}
          icon={ShoppingBag}
          trend={8.2}
          subValue="vs yesterday"
          color="bg-blue-500"
        />
        <StatCard 
          title="AVG ORDER VALUE" 
          value={`Rp ${Math.round(data.totalRevenue / (data.totalOrders || 1)).toLocaleString('id-ID')}`}
          icon={Coffee}
          trend={-2.4}
          subValue="vs yesterday"
          color="bg-amber-500"
        />
        <StatCard 
          title="CONVERSION RATE" 
          value="4.2%"
          icon={Users}
          trend={1.1}
          subValue="vs yesterday"
          color="bg-brand-500"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 glass-card p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-white">Hourly Sales Trend</h3>
            <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
              Today / 24h
            </span>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.hourlySales}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A8131E" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#A8131E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="hour" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}:00`}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `Rp ${val / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a0508', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#A8131E" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products Chart */}
        <div className="glass-card p-8">
          <h3 className="text-xl font-bold text-white mb-8">Best Sellers</h3>
          <div className="space-y-6">
            {data.topProducts.map((product: any, idx: number) => (
              <div key={idx} className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                    {product.name}
                  </span>
                  <span className="text-xs font-bold text-white/40">{product.quantity} sold</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                    style={{ width: `${(product.quantity / data.topProducts[0].quantity) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {data.topProducts.length === 0 && (
              <div className="py-20 text-center space-y-3">
                <Coffee className="w-12 h-12 text-white/5 mx-auto" />
                <p className="text-white/20 text-sm">No sales data yet today</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="flex justify-center pt-8 border-t border-white/5">
        <p className="text-[10px] text-white/10 uppercase tracking-[0.3em]">
          Rakken Coffee Admin Engine — Last Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
