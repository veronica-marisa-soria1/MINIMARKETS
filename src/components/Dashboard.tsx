import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Clock
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
import { formatCurrency, cn, handleFirestoreError, OperationType } from '../lib/utils';
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

export default function Dashboard({ userRole }: { userRole: 'admin' | 'staff' | null }) {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayProfit: 0,
    totalProducts: 0,
    lowStock: 0,
    monthlyRevenue: 0
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [activeShifts, setActiveShifts] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    // Products Stats & Map
    const productsQuery = collection(db, 'products');
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      let total = 0;
      let low = 0;
      const pMap: Record<string, any> = {};
      snapshot.forEach(doc => {
        total++;
        const data = doc.data();
        pMap[doc.id] = data;
        if (data.stock <= (data.minStock || 5)) {
          low++;
        }
      });
      setProductsMap(pMap);
      setStats(prev => ({ ...prev, totalProducts: total, lowStock: low }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    // Today's Sales & Profit
    const salesQuery = query(
      collection(db, 'sales'),
      where('timestamp', '>=', todayTimestamp)
    );

    const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
      let totalSales = 0;
      let totalCost = 0;
      
      snapshot.forEach(doc => {
        const sale = doc.data();
        totalSales += sale.total;
        
        // Calculate cost from items
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach((item: any) => {
            // Try to get cost from sale item (future proof) or from products map
            const itemCost = item.cost || productsMap[item.productId]?.cost || 0;
            totalCost += itemCost * item.quantity;
          });
        }
      });
      
      setStats(prev => ({ 
        ...prev, 
        todaySales: totalSales,
        todayProfit: totalSales - totalCost
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    // Recent Sales
    const recentQuery = query(
      collection(db, 'sales'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubscribeRecent = onSnapshot(recentQuery, (snapshot) => {
      const sales: any[] = [];
      snapshot.forEach(doc => {
        sales.push({ id: doc.id, ...doc.data() });
      });
      setRecentSales(sales);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    // Active Shifts (Admin only)
    let unsubscribeShifts = () => {};
    if (userRole === 'admin') {
      const shiftsQuery = query(
        collection(db, 'shifts'),
        where('status', '==', 'open')
      );
      unsubscribeShifts = onSnapshot(shiftsQuery, (snapshot) => {
        const shifts: any[] = [];
        snapshot.forEach(doc => {
          shifts.push({ id: doc.id, ...doc.data() });
        });
        setActiveShifts(shifts);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'shifts');
      });
    }

    // Chart Data
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
      unsubscribeShifts();
    };
  }, [productsMap, userRole]); // Re-run if productsMap or userRole changes

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
      label: 'Ganancia de Hoy', 
      value: formatCurrency(stats.todayProfit), 
      icon: TrendingUp, 
      color: 'bg-indigo-600',
      trend: stats.todayProfit > 0 ? 'Rentable' : 'Sin datos',
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
      label: 'Productos Totales', 
      value: stats.totalProducts, 
      icon: Package, 
      color: 'bg-blue-500',
      trend: '+3 nuevos',
      trendUp: true
    },
    ...(userRole === 'admin' ? [{
      label: 'Gestión Personal',
      value: stats.admins + stats.staff,
      icon: Users,
      color: 'bg-purple-600',
      trend: stats.pending > 0 ? `${stats.pending} pendientes` : 'Al día',
      trendUp: stats.pending === 0,
      isLink: true
    }] : [])
  ];

  // Add stats for admins
  const [adminStats, setAdminStats] = useState({ admins: 0, staff: 0, pending: 0 });
  useEffect(() => {
    if (userRole === 'admin') {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let a = 0, s = 0, p = 0;
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.role === 'admin') a++;
          if (data.role === 'staff') s++;
          if (!data.authorized) p++;
        });
        setAdminStats({ admins: a, staff: s, pending: p });
      });
      return () => unsubscribe();
    }
  }, [userRole]);

  // Update stats with admin counts if needed
  const finalStats = { ...stats, ...adminStats };

  const finalCards = cards.map(c => {
    if (c.label === 'Gestión Personal') {
      return { ...c, value: finalStats.admins + finalStats.staff, trend: finalStats.pending > 0 ? `${finalStats.pending} pendientes` : 'Al día' };
    }
    return c;
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Bienvenido de nuevo</h2>
        <p className="text-slate-500 text-sm">Aquí tienes un resumen de lo que está pasando hoy.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {finalCards.map((card, idx) => (
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

      {/* Admin Monitoring Section */}
      {userRole === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Management Menu */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Menú de Gestión</h3>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'users' }))}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-600 border border-slate-100 group-hover:border-indigo-200">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900">Gestionar Cajeros</p>
                      <p className="text-[10px] text-slate-500 font-medium">Administra el personal de ventas</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
                </button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'inventory' }))}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-blue-600 border border-slate-100 group-hover:border-blue-200">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900">Gestionar Inventario</p>
                      <p className="text-[10px] text-slate-500 font-medium">Control de stock y precios</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-6 italic">* Acceso exclusivo para administradores</p>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Turnos Activos en Tiempo Real</h3>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-600 text-xs font-bold rounded-full flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {activeShifts.length} {activeShifts.length === 1 ? 'Cajero' : 'Cajeros'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeShifts.length > 0 ? activeShifts.map((shift) => (
                <div key={shift.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                      <Users className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{shift.cashierName}</p>
                      <p className="text-[10px] text-slate-500 font-medium">Inició: {shift.startTime?.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <DollarSign className="w-3 h-3" />
                      Ventas:
                    </div>
                    <span className="text-sm font-bold text-indigo-600">{formatCurrency(shift.totalSales || 0)}</span>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm italic">No hay turnos abiertos en este momento.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{sale.cashierName || 'S/N'}</p>
                    <span className="text-slate-300">•</span>
                    <p className="text-xs text-slate-500">
                      {sale.timestamp?.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
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
