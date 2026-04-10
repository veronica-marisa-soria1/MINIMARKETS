import React, { useState, useEffect } from 'react';
import { Lock, Save, Shield, Key, Building2, FileKey } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function Settings() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [storedPin, setStoredPin] = useState('1234');

  useEffect(() => {
    const fetchPin = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'admin'));
        if (settingsDoc.exists()) {
          setStoredPin(settingsDoc.data().pin || '1234');
        }
      } catch (error) {
        console.error("Error fetching PIN:", error);
      }
    };
    fetchPin();
  }, []);

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (currentPin !== storedPin) {
      setMessage({ type: 'error', text: 'La clave actual es incorrecta.' });
      return;
    }

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      setMessage({ type: 'error', text: 'La nueva clave debe ser de 4 dígitos numéricos.' });
      return;
    }

    if (newPin !== confirmPin) {
      setMessage({ type: 'error', text: 'Las claves nuevas no coinciden.' });
      return;
    }

    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'admin'), { pin: newPin }, { merge: true });
      setStoredPin(newPin);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setMessage({ type: 'success', text: 'Clave de acceso actualizada correctamente.' });
    } catch (error) {
      console.error("Error updating PIN:", error);
      setMessage({ type: 'error', text: 'Error al actualizar la clave.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Configuración</h2>
        <p className="text-slate-500 font-medium">Administra las preferencias de seguridad del sistema.</p>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Seguridad de Acceso</h3>
              <p className="text-indigo-100 font-medium">Cambia la clave maestra para el menú de gestión.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleUpdatePin} className="p-8 space-y-6">
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-2xl text-sm font-bold flex items-center gap-3",
                message.type === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
              )}
            >
              <Lock className="w-5 h-5" />
              {message.text}
            </motion.div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Clave Actual</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  required
                  type="password" 
                  maxLength={4}
                  placeholder="••••"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-900"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Nueva Clave (4 dígitos)</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    required
                    type="password" 
                    maxLength={4}
                    placeholder="••••"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-900"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Confirmar Nueva Clave</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    required
                    type="password" 
                    maxLength={4}
                    placeholder="••••"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-900"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Nueva Clave
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">Configuración AFIP / ARCA</h3>
            <p className="text-slate-500 text-sm font-medium">Estado de la conexión para facturación electrónica.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <FileKey className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-bold text-slate-700">Certificados Digitales</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">cert.crt</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg font-bold">Pendiente</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">key.key</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg font-bold">Pendiente</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
              Para habilitar la facturación real, debes subir tus archivos de certificado a la carpeta <code className="bg-slate-200 px-1 rounded">/afip-certs</code>.
            </p>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-bold text-slate-700">Identificación</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">CUIT Configurado</span>
                <span className="font-bold text-slate-900">No definido</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Entorno</span>
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-bold uppercase">Testing</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
              Configura tu CUIT en las variables de entorno para vincular el sistema con tu cuenta de AFIP.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
