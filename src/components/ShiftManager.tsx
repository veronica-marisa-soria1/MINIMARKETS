import React, { useState } from 'react';
import { 
  collection, 
  addDoc, 
  Timestamp, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatCurrency, cn, handleFirestoreError, OperationType } from '../lib/utils';
import { motion } from 'motion/react';
import { Clock, User, ArrowRight, LogIn, LogOut, CheckCircle2 } from 'lucide-react';

interface ShiftManagerProps {
  user: any;
  activeShift?: any;
  onShiftStarted: (shift: any) => void;
  onShiftClosed: () => void;
}

const DENOMINATIONS = [2000, 1000, 500, 200, 100, 50, 20, 10];

export default function ShiftManager({ user, activeShift, onShiftStarted, onShiftClosed }: ShiftManagerProps) {
  const [cashierName, setCashierName] = useState(user.displayName || '');
  const [initialCash, setInitialCash] = useState<number>(0);
  const [billCounts, setBillCounts] = useState<Record<number, number>>({});
  const [closeBillCounts, setCloseBillCounts] = useState<Record<number, number>>({});
  const [showDenominations, setShowDenominations] = useState(false);
  const [showCloseDenominations, setShowCloseDenominations] = useState(false);
  const [finalCashManual, setFinalCashManual] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);
  const [showFinalSummary, setShowFinalSummary] = useState(false);
  const [finalSummaryData, setFinalSummaryData] = useState<any>(null);

  const handleBillCountChange = (denom: number, count: string) => {
    const val = parseInt(count) || 0;
    const newCounts = { ...billCounts, [denom]: val };
    setBillCounts(newCounts);
    
    const newTotal = Object.keys(newCounts).reduce((sum, denomStr) => {
      const denom = parseInt(denomStr);
      const count = newCounts[denom];
      return sum + (denom * count);
    }, 0);
    setInitialCash(newTotal);
  };

  const handleCloseBillCountChange = (denom: number, count: string) => {
    const val = parseInt(count) || 0;
    const newCounts = { ...closeBillCounts, [denom]: val };
    setCloseBillCounts(newCounts);
    
    const newTotal = Object.keys(newCounts).reduce((sum, denomStr) => {
      const denom = parseInt(denomStr);
      const count = newCounts[denom];
      return sum + (denom * count);
    }, 0);
    setFinalCashManual(newTotal);
  };

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
        totalSales: 0,
        cashSales: 0
      };

      const docRef = await addDoc(collection(db, 'shifts'), shiftData);
      onShiftStarted({ id: docRef.id, ...shiftData });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.CREATE, 'shifts');
      }
      console.error("Error starting shift:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    const cashSales = activeShift.cashSales || 0;
    const expectedCash = (activeShift.initialCash || 0) + cashSales;
    
    setLoading(true);
    try {
      const difference = finalCashManual ? finalCashManual - expectedCash : 0;
      const finalData = {
        status: 'closed',
        endTime: Timestamp.now(),
        finalCash: finalCashManual || expectedCash,
        actualCash: finalCashManual,
        difference: difference,
        initialCash: activeShift.initialCash || 0,
        cashSales: cashSales,
        totalSales: activeShift.totalSales || 0
      };

      await updateDoc(doc(db, 'shifts', activeShift.id), finalData);
      
      setFinalSummaryData(finalData);
      setShowFinalSummary(true);
      setIsConfirmingClose(false);
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.UPDATE, `shifts/${activeShift.id}`);
      }
      console.error("Error closing shift:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishSummary = () => {
    onShiftClosed();
    setShowFinalSummary(false);
    setFinalSummaryData(null);
    setFinalCashManual(0);
    setCloseBillCounts({});
  };

  if (activeShift) {
    const cashSales = activeShift.cashSales || 0;
    const totalSales = activeShift.totalSales || 0;
    const expectedCash = (activeShift.initialCash || 0) + cashSales;

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
                onClick={() => setIsConfirmingClose(true)}
                disabled={loading}
                className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" />
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
              <p className="text-2xl font-black text-indigo-600">{formatCurrency(totalSales)}</p>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {isConfirmingClose && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <LogOut className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Confirmar Cierre de Turno</h3>
                <p className="text-slate-500 mt-2">Revisa el arqueo de caja antes de finalizar.</p>
              </div>

              <div className="p-8 space-y-4">
                <div className="bg-slate-50 rounded-2xl p-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Efectivo Esperado:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(expectedCash)}</span>
                  </div>
                  
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-700">Efectivo Real en Caja:</span>
                      <button 
                        type="button"
                        onClick={() => setShowCloseDenominations(!showCloseDenominations)}
                        className="text-[10px] font-bold text-indigo-600 hover:underline uppercase"
                      >
                        {showCloseDenominations ? 'Ocultar' : 'Contar Billetes'}
                      </button>
                    </div>

                    {showCloseDenominations ? (
                      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 mb-3">
                        {DENOMINATIONS.map(denom => (
                          <div key={denom} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 w-8 text-right">${denom}</span>
                            <input 
                              type="number" 
                              min="0"
                              placeholder="0"
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded text-xs font-bold outline-none"
                              value={closeBillCounts[denom] || ''}
                              onChange={(e) => handleCloseBillCountChange(denom, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="relative mb-3">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input 
                          type="number" 
                          placeholder="Ingresa monto total..."
                          className="w-full pl-7 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                          value={finalCashManual || ''}
                          onChange={(e) => {
                            setFinalCashManual(parseFloat(e.target.value) || 0);
                            setCloseBillCounts({});
                          }}
                        />
                      </div>
                    )}

                    <div className="flex justify-between items-center p-3 bg-indigo-600 rounded-xl text-white">
                      <span className="text-xs font-bold uppercase">Total Contado:</span>
                      <span className="text-lg font-black">{formatCurrency(finalCashManual || 0)}</span>
                    </div>

                    {finalCashManual > 0 && (
                      <div className={cn(
                        "mt-2 p-2 rounded-lg text-center text-xs font-bold",
                        finalCashManual === expectedCash ? "bg-emerald-100 text-emerald-700" :
                        finalCashManual > expectedCash ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                      )}>
                        Diferencia: {formatCurrency(finalCashManual - expectedCash)}
                        {finalCashManual === expectedCash ? " (Caja Cuadrada)" : 
                         finalCashManual > expectedCash ? " (Sobrante)" : " (Faltante)"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Ventas Totales</span>
                  <span className="text-lg font-bold text-slate-700">{formatCurrency(totalSales)}</span>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setIsConfirmingClose(false)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCloseShift}
                  disabled={loading}
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar Cierre'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Final Summary Modal */}
        {showFinalSummary && finalSummaryData && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-lg p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 bg-indigo-600 text-white text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold">Turno Cerrado</h3>
                <p className="text-indigo-100 mt-1">Resumen final del arqueo</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Caja Inicial</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(finalSummaryData.initialCash)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ventas Efectivo</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(finalSummaryData.cashSales)}</p>
                  </div>
                </div>

                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-indigo-900">Efectivo Esperado:</span>
                    <span className="text-lg font-bold text-indigo-900">{formatCurrency(finalSummaryData.initialCash + finalSummaryData.cashSales)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-indigo-900">Efectivo Real:</span>
                    <span className="text-lg font-bold text-indigo-900">{formatCurrency(finalSummaryData.actualCash || (finalSummaryData.initialCash + finalSummaryData.cashSales))}</span>
                  </div>
                  <div className="h-px bg-indigo-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-indigo-900">Diferencia:</span>
                    <span className={cn(
                      "text-xl font-black",
                      finalSummaryData.difference === 0 ? "text-emerald-600" :
                      finalSummaryData.difference > 0 ? "text-blue-600" : "text-red-600"
                    )}>
                      {formatCurrency(finalSummaryData.difference)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center px-2">
                  <span className="text-sm font-bold text-slate-400 uppercase">Ventas Totales (Mix)</span>
                  <span className="text-xl font-black text-slate-900">{formatCurrency(finalSummaryData.totalSales)}</span>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={handleFinishSummary}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-slate-200"
                >
                  Finalizar y Salir
                </button>
              </div>
            </motion.div>
          </div>
        )}

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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                  <LogIn className="w-4 h-4 text-indigo-500" />
                  Caja Inicial
                </label>
                <button 
                  type="button"
                  onClick={() => setShowDenominations(!showDenominations)}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  {showDenominations ? 'Ocultar Desglose' : 'Contar Billetes'}
                </button>
              </div>

              {showDenominations ? (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {DENOMINATIONS.map(denom => (
                      <div key={denom} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-10 text-right">${denom}</span>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={billCounts[denom] || ''}
                          onChange={(e) => handleBillCountChange(denom, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase">Total Calculado:</span>
                    <span className="text-lg font-black text-indigo-600">{formatCurrency(initialCash)}</span>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-medium"
                    value={initialCash || ''}
                    onChange={(e) => {
                      setInitialCash(parseFloat(e.target.value) || 0);
                      setBillCounts({}); // Reset counts if manual entry
                    }}
                  />
                </div>
              )}
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
