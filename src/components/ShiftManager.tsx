import React, { useState } from 'react';
import { 
  collection, 
  addDoc, 
  Timestamp, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatCurrency } from '../lib/utils';
import { motion } from 'motion/react';
import { Clock, User, ArrowRight, LogIn, LogOut } from 'lucide-react';

interface ShiftManagerProps {
  user: any;
  activeShift?: any;
  onShiftStarted: (shift: any) => void;
  onShiftClosed: () => void;
}

export default function ShiftManager({ user, activeShift, onShiftStarted, onShiftClosed }: ShiftManagerProps) {
  const [cashierName, setCashierName] = useState(user.displayName || '');
  const [initialCash, setInitialCash] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierName.trim()) return;

    setLoading(true);
    try {
      const shiftData = {
        cashierName,
        initialCash,
        startTime: Timestamp.now(),
        status: 'open',
        userId: user.uid,
        totalSales: 0
      };

      const docRef = await addDoc(collection(db, 'shifts'), shiftData);
      onShiftStarted({ id: docRef.id, ...shiftData });
    } catch (error) {
      console.error("Error starting shift:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    if (window.confirm('¿Estás seguro de que deseas cerrar el turno actual?')) {
      setLoading(true);
      try {
        await updateDoc(doc(db, 'shifts', activeShift.id), {
          status: 'closed',
          endTime: Timestamp.now()
        });
        onShiftClosed();
      } catch (error) {
        console.error("Error closing shift:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  if (activeShift) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Turno Actual</h2>
                  <p className="text-indigo-100 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    En curso desde las {activeShift.startTime?.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleCloseShift}
                disabled={loading}
                className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors flex items-center gap-2"
              >
                {loading ? <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /> : <LogOut className="w-5 h-5" />}
                Cerrar Turno
              </button>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cajero Responsable</p>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-500" />
                <p className="text-lg font-bold text-slate-900">{activeShift.cashierName}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Caja Inicial</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(activeShift.initialCash || 0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Ventas Acumuladas</p>
              <p className="text-2xl font-black text-indigo-600">{formatCurrency(activeShift.totalSales || 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-start gap-4">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-amber-900">Recordatorio de Cierre</h4>
            <p className="text-sm text-amber-700 mt-1">
              Recuerda cerrar tu turno al finalizar tu jornada para generar el reporte de ventas y arqueo de caja correspondiente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="bg-indigo-600 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-24 h-24 bg-indigo-400/20 rounded-full blur-xl" />
          
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Apertura de Turno</h2>
          <p className="text-indigo-100 text-sm mt-1">Inicia tu jornada laboral para comenzar a vender.</p>
        </div>

        <form onSubmit={handleStartShift} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" />
                Nombre del Cajero
              </label>
              <input 
                required
                type="text" 
                placeholder="Ej: Juan Pérez"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-medium"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <LogIn className="w-4 h-4 text-indigo-500" />
                Caja Inicial (Opcional)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input 
                  type="number" 
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-medium"
                  value={initialCash || ''}
                  onChange={(e) => setInitialCash(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Iniciar Turno
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
