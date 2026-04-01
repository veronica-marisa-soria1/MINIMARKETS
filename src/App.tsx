/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  History, 
  LogOut, 
  Clock,
  Menu, 
  X,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  PackageCheck,
  Users,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit,
  where,
  Timestamp,
  updateDoc,
  doc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { cn, formatCurrency } from './lib/utils';

// Views
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS from './components/POS';
import SalesHistory from './components/SalesHistory';
import ShiftManager from './components/ShiftManager';
import UserManagement from './components/UserManagement';
import { setDoc } from 'firebase/firestore';

type View = 'dashboard' | 'inventory' | 'pos' | 'history' | 'users' | 'shift';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeShift, setActiveShift] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Fetch role from users collection
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeRole = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role);
          } else {
            // Create user record if it doesn't exist
            const role = user.email === "soriav449veronica@gmail.com" ? 'admin' : 'staff';
            await setDoc(userDocRef, {
              email: user.email,
              displayName: user.displayName,
              role: role,
              uid: user.uid
            });
            setUserRole(role);
          }
        });
        setLoading(false);
        return () => unsubscribeRole();
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Check for active shift on login
  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'shifts'),
        where('userId', '==', user.uid),
        where('status', '==', 'open'),
        limit(1)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const shiftDoc = snapshot.docs[0];
          setActiveShift({ id: shiftDoc.id, ...shiftDoc.data() });
        } else {
          setActiveShift(null);
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Package className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Minimark AyB</h1>
          <p className="text-slate-500 mb-8">Inicia sesión para gestionar tu stock y ventas.</p>
          <button
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Continuar con Google
          </button>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Panel Control', icon: LayoutDashboard },
    { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'history', label: 'Historial', icon: History },
    { id: 'shift', label: 'Turno Actual', icon: Clock },
    ...(userRole === 'admin' ? [{ id: 'users', label: 'Usuarios', icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-white" />
          </div>
          {isSidebarOpen && <span className="font-bold text-slate-900 truncate">Minimark AyB</span>}
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as View)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                currentView === item.id 
                  ? "bg-indigo-50 text-indigo-600" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className={cn("flex items-center gap-3 mb-4", !isSidebarOpen && "justify-center")}>
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              className="w-8 h-8 rounded-full border border-slate-200"
              alt="Avatar"
            />
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 truncate">{user.displayName}</p>
                  {userRole === 'admin' && (
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded uppercase">Admin</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors",
              !isSidebarOpen && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {isSidebarOpen && <span className="font-medium">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-4">
            {activeShift && (
              <div className="hidden md:flex items-center gap-3 px-4 py-1.5 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <div className="text-left">
                  <p className="text-[10px] text-indigo-400 font-bold uppercase leading-none">Turno Activo</p>
                  <p className="text-xs font-bold text-indigo-700">{activeShift.cashierName}</p>
                </div>
                <button 
                  onClick={() => setCurrentView('shift')}
                  className="ml-2 p-1.5 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors"
                  title="Ver Turno"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Fecha Actual</p>
              <p className="text-sm font-semibold text-slate-900">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentView === 'dashboard' && <Dashboard userRole={userRole} />}
              {currentView === 'inventory' && <Inventory />}
              {currentView === 'pos' && <POS user={user} activeShift={activeShift} />}
              {currentView === 'history' && <SalesHistory />}
              {currentView === 'users' && <UserManagement />}
              {currentView === 'shift' && (
                <ShiftManager 
                  user={user} 
                  activeShift={activeShift}
                  onShiftStarted={(shift) => setActiveShift(shift)}
                  onShiftClosed={() => setActiveShift(null)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Blocking Shift Manager when no active shift */}
      <AnimatePresence>
        {!activeShift && (
          <ShiftManager 
            user={user} 
            onShiftStarted={(shift) => setActiveShift(shift)}
            onShiftClosed={() => setActiveShift(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
