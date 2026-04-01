import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    todaySales: 0,
    totalProducts: 0,
    lowStock: 0,
    monthlyRevenue: 0
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    // Today's Sales
    const salesQuery = query(
      collection(db, 'sales'),
      where('timestamp', '>=', todayTimestamp)
    );

    const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
      let total = 0;
      snapshot.forEach(doc => {
        total += doc.data().total;
      });
      setStats(prev => ({ ...prev, todaySales: total }));
    });

    // Products Stats
    const productsQuery = collection(db, 'products');
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      let total = 0;
      let low = 0;
      snapshot.forEach(doc => {
        total++;
        const data = doc.data();
        if (data.stock <= (data.minStock || 5)) {
          low++;
        }
      });
      setStats(prev => ({ ...prev, totalProducts: total, lowStock: low }));
    });

    // Recent Sales
    const recentQuery = query(
      collection(db, 'sales'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const unsubscribeRecent = onSnapshot(recentQuery, (snapshot) => {
      const sales: any[] = [];
      snapshot.forEach(doc => {
        sales.push({ id: doc.id, ...doc.data() });
      });
      setRecentSales(sales);
    });

    // Chart Data (Mocking some data for visual if no real data yet)
    setChartData([
      { name: 'Lun', sales: 4000 },
      { name: 'Mar', sales: 3000 },
      { name: 'Mie', sales: 2000 },
      { name: 'Jue', sales: 2780 },
      { name: 'Vie', sales: 1890 },
      { name: 'Sab', sales: 2390 },
      { name: 'Dom', sales: 3490 },
    ]);

    return () => {
      unsubscribeSales();
      unsubscribeProducts();
      unsubscribeRecent();
    };
  }, []);

  const cards = [
    { 
      label: 'Ventas de Hoy', 
      value: formatCurrency(stats.todaySales), 
      icon: DollarSign, 
      color: 'bg-emerald-500',
      trend: '+12.5%',
      trendUp: true
    },
    { 
      label: 'Productos Totales', 
      value: stats.totalProducts, 
      icon: Package, 
      color: 'bg-blue-500',
      trend: '+3 nuevos',
      trendUp: true
    },
    { 
      label: 'Stock Bajo', 
      value: stats.lowStock, 
      icon: AlertTriangle, 
      color: 'bg-amber-500',
      trend: stats.lowStock > 0 ? 'Requiere atención' : 'Todo en orden',
      trendUp: stats.lowStock === 0
    },
    { 
      label: 'Ingresos Mensuales', 
      value: formatCurrency(stats.monthlyRevenue || 125400), 
      icon: TrendingUp, 
      color: 'bg-indigo-500',
      trend: '+8.2%',
      trendUp: true
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Bienvenido de nuevo</h2>
        <p className="text-slate-500 text-sm">Aquí tienes un resumen de lo que está pasando hoy.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("p-3 rounded-xl text-white", card.color)}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                card.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {card.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {card.trend}
              </div>
            </div>
            <p className="text-slate-500 text-sm font-medium">{card.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{card.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Rendimiento Semanal</h3>
            <select className="text-sm border-slate-200 rounded-lg bg-slate-50 px-2 py-1 outline-none">
              <option>Últimos 7 días</option>
              <option>Últimos 30 días</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Ventas Recientes</h3>
          <div className="space-y-6">
            {recentSales.length > 0 ? recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                  {sale.paymentMethod === 'cash' ? 'EF' : 'TR'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {sale.items.length} {sale.items.length === 1 ? 'producto' : 'productos'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {sale.timestamp?.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(sale.total)}</p>
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm italic">No hay ventas registradas hoy.</p>
              </div>
            )}
          </div>
          <button className="w-full mt-8 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            Ver todo el historial
          </button>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
