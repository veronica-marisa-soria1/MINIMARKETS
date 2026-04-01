import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  ChevronRight, 
  ChevronDown,
  Download,
  Filter,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  RotateCcw,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  Timestamp,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Sale {
  id: string;
  items: any[];
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  timestamp: Timestamp;
  userId: string;
  cashierName?: string;
  shiftId?: string;
  amountPaid?: number;
  change?: number;
}

export default function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    let q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      q = query(q, where('timestamp', '>=', Timestamp.fromDate(start)));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      q = query(q, where('timestamp', '<=', Timestamp.fromDate(end)));
    }

    // Limit only if no filters are applied to avoid missing data, 
    // or keep a reasonable limit for performance.
    if (!startDate && !endDate) {
      q = query(q, limit(50));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const salesData: Sale[] = [];
      snapshot.forEach(doc => {
        salesData.push({ id: doc.id, ...doc.data() } as Sale);
      });
      setSales(salesData);
    });
    return () => unsubscribe();
  }, [startDate, endDate]);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  const exportToCSV = () => {
    if (filteredSales.length === 0) return;

    const headers = ['ID Venta', 'Fecha', 'Hora', 'Cajero', 'Metodo Pago', 'Total', 'Productos'];
    const rows = filteredSales.map(sale => {
      const date = sale.timestamp?.toDate().toLocaleDateString('es-AR');
      const time = sale.timestamp?.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const items = sale.items.map(item => `${item.quantity}x ${item.name}`).join('; ');
      
      return [
        `"${sale.id}"`,
        `"${date}"`,
        `"${time}"`,
        `"${sale.cashierName || 'N/A'}"`,
        `"${sale.paymentMethod}"`,
        `"${sale.total}"`,
        `"${items}"`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ventas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'transfer': return <Smartphone className="w-4 h-4" />;
      default: return <History className="w-4 h-4" />;
    }
  };

  const filteredSales = sales.filter(s => 
    s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const summary = filteredSales.reduce((acc, sale) => {
    acc.totalSales += sale.total;
    sale.items.forEach(item => {
      acc.totalCost += (item.cost || 0) * item.quantity;
      acc.totalItems += item.quantity;
    });
    return acc;
  }, { totalSales: 0, totalCost: 0, totalItems: 0 });

  const totalProfit = summary.totalSales - summary.totalCost;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Historial de Ventas</h2>
          <p className="text-slate-500 text-sm">Consulta y gestiona todas las transacciones realizadas.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportToCSV}
            disabled={filteredSales.length === 0}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            Exportar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Ventas Totales</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.totalSales)}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Ganancia Estimada</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalProfit)}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
            <History className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Productos Vendidos</p>
            <p className="text-xl font-bold text-slate-900">{summary.totalItems}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por ID o método de pago..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border border-transparent focus-within:border-indigo-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-1">
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-sm text-slate-700 p-1"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-slate-300">al</span>
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-sm text-slate-700 p-1"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          {(startDate || endDate || searchTerm) && (
            <button 
              onClick={resetFilters}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Limpiar filtros"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID Venta</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha y Hora</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cajero</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Método</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Productos</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <React.Fragment key={sale.id}>
                  <tr 
                    className={cn(
                      "hover:bg-slate-50 transition-colors cursor-pointer",
                      expandedSale === sale.id && "bg-indigo-50/30"
                    )}
                    onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-slate-400">#{sale.id.slice(-8).toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">
                          {sale.timestamp?.toDate().toLocaleDateString('es-AR')}
                        </span>
                        <span className="text-xs text-slate-500">
                          {sale.timestamp?.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">{sale.cashierName || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase">
                        {getPaymentIcon(sale.paymentMethod)}
                        {sale.paymentMethod}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{sale.items.length} items</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900">{formatCurrency(sale.total)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                        {expandedSale === sale.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedSale === sale.id && (
                      <tr>
                        <td colSpan={6} className="px-6 py-0">
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="py-4 space-y-4">
                              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Detalle de Productos</h4>
                                <div className="space-y-2">
                                  {sale.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                      <div className="flex gap-2">
                                        <span className="font-bold text-indigo-600">{item.quantity}x</span>
                                        <span className="text-slate-700">{item.name}</span>
                                      </div>
                                      <div className="flex gap-4">
                                        <span className="text-slate-400">{formatCurrency(item.price)}</span>
                                        <span className="font-bold text-slate-900">{formatCurrency(item.subtotal)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs text-slate-500">Cajero: <span className="font-bold text-slate-700">{sale.cashierName || 'N/A'}</span></span>
                                    <span className="text-xs text-slate-500">ID Turno: <span className="font-mono">{sale.shiftId || 'N/A'}</span></span>
                                    {sale.paymentMethod === 'cash' && sale.amountPaid !== undefined && (
                                      <>
                                        <span className="text-xs text-slate-500">Recibido: <span className="font-bold text-slate-700">{formatCurrency(sale.amountPaid)}</span></span>
                                        <span className="text-xs text-slate-500">Vuelto: <span className="font-bold text-emerald-600">{formatCurrency(sale.change || 0)}</span></span>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-slate-500 font-bold uppercase">Total Final</p>
                                    <p className="text-lg font-bold text-indigo-600">{formatCurrency(sale.total)}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSales.length === 0 && (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No se encontraron ventas registradas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
