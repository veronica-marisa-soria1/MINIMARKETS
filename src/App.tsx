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
  User as UserIcon,
  Lock,
  Shield
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
  doc,
  getDocs,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { cn, formatCurrency, handleFirestoreError, OperationType } from './lib/utils';

// Views
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS from './components/POS';
import SalesHistory from './components/SalesHistory';
import ShiftManager from './components/ShiftManager';
import UserManagement from './components/UserManagement';
import Settings from './components/Settings';

type View = 'dashboard' | 'inventory' | 'pos' | 'history' | 'users' | 'shift' | 'settings';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [storedPin, setStoredPin] = useState('1234');

  const PROTECTED_VIEWS: View[] = ['dashboard', 'inventory', 'users', 'settings'];

  useEffect(() => {
    // Fetch PIN from Firestore
    const unsubscribePin = onSnapshot(doc(db, 'settings', 'admin'), (doc) => {
      if (doc.exists()) {
        setStoredPin(doc.data().pin || '1234');
      }
    });
    return () => unsubscribePin();
  }, []);

  useEffect(() => {
    const handleEventViewChange = (e: any) => {
      if (e.detail) {
        const view = e.detail as View;
        if (userRole === 'admin' && PROTECTED_VIEWS.includes(view) && !isAdminVerified) {
          setPendingView(view);
          setPin('');
          setPinError(false);
        } else {
          setCurrentView(view);
        }
      }
    };
    window.addEventListener('changeView', handleEventViewChange);
    return () => window.removeEventListener('changeView', handleEventViewChange);
  }, [userRole, isAdminVerified]);

  useEffect(() => {
    if (!loading && userRole) {
      if (userRole === 'staff' && currentView === 'dashboard') {
        setCurrentView('pos');
      }
    }
  }, [userRole, loading]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const isMaster = user.email === "soriav449veronica@gmail.com";
        
        // Fetch role from users collection
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeRole = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Master admin is ALWAYS authorized and ALWAYS admin
            if (isMaster) {
              setUserRole('admin');
              // Auto-fix document if it's incorrect
              if (!data.authorized || data.role !== 'admin') {
                await updateDoc(userDocRef, { authorized: true, role: 'admin' });
              }
            } else if (data.authorized) {
              setUserRole(data.role);
            } else {
              setUserRole(null);
            }
            setLoading(false);
          } else {
            // Master admin bypasses pre-auth check to avoid permission errors on getDocs
            if (isMaster) {
              const role = 'admin';
              await setDoc(userDocRef, {
                email: user.email,
                displayName: user.displayName,
                role: role,
                uid: user.uid,
                authorized: true
              });
              setUserRole(role);
              setLoading(false);
              return;
            }

            // Check if there is a pre-authorized user by email (only for non-masters)
            try {
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('email', '==', user.email));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const preAuthDoc = querySnapshot.docs[0];
                const preAuthData = preAuthDoc.data();
                
                await setDoc(userDocRef, {
                  ...preAuthData,
                  uid: user.uid,
                  displayName: user.displayName,
                  preAuthorized: false
                });
                
                if (preAuthDoc.id !== user.uid) {
                  await deleteDoc(doc(db, 'users', preAuthDoc.id));
                }
                
                if (preAuthData.authorized) {
                  setUserRole(preAuthData.role);
                } else {
                  setUserRole(null);
                }
              } else {
                const role = 'staff';
                const authorized = false;
                
                await setDoc(userDocRef, {
                  email: user.email,
                  displayName: user.displayName,
                  role: role,
                  uid: user.uid,
                  authorized: authorized
                });
                setUserRole(null);
              }
            } catch (e) {
              console.error("Error checking pre-auth:", e);
              // Fallback: create unauthorized record
              await setDoc(userDocRef, {
                email: user.email,
                displayName: user.displayName,
                role: 'staff',
                uid: user.uid,
                authorized: false
              });
              setUserRole(null);
            }
            setLoading(false);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });
        return () => unsubscribeRole();
      }
 else {
        setUserRole(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Check for active shift on login
  useEffect(() => {
    if (user && userRole) {
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
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'shifts');
      });
      return () => unsubscribe();
    }
  }, [user, userRole]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setIsAdminVerified(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const handleViewChange = (view: View) => {
    if (userRole === 'admin' && PROTECTED_VIEWS.includes(view) && !isAdminVerified) {
      setPendingView(view);
      setPin('');
      setPinError(false);
    } else {
      setCurrentView(view);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === storedPin) {
      setIsAdminVerified(true);
      if (pendingView) {
        setCurrentView(pendingView);
        setPendingView(null);
      }
      setPin('');
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
    }
  };

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
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Software de Ventas</h1>
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

  if (user && !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso Denegado</h1>
          <p className="text-slate-500 mb-8">
            Tu cuenta ({user.email}) no está autorizada para ingresar al sistema. 
            Contacta al administrador para solicitar acceso.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors"
          >
            Cerrar Sesión
          </button>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    ...(userRole === 'admin' ? [
      { id: 'dashboard', label: 'Panel Control', icon: LayoutDashboard },
      { id: 'inventory', label: 'Inventario', icon: Package },
      { id: 'history', label: 'Historial', icon: History },
      { id: 'users', label: 'Gestión de Cajeros', icon: Users },
      { id: 'settings', label: 'Configuración', icon: Shield }
    ] : [
      { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart },
      { id: 'shift', label: 'Turno Actual', icon: Clock },
      { id: 'history', label: 'Historial', icon: History },
    ]),
    ...(userRole === 'admin' ? [
      { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart },
      { id: 'shift', label: 'Turno Actual', icon: Clock }
    ] : []),
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
          {isSidebarOpen && <span className="font-bold text-slate-900 truncate">Software de Ventas</span>}
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleViewChange(item.id as View)}
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
              {currentView === 'inventory' && <Inventory userRole={userRole} />}
              {currentView === 'pos' && <POS user={user} activeShift={activeShift} />}
              {currentView === 'history' && <SalesHistory userRole={userRole} />}
              {currentView === 'users' && <UserManagement />}
              {currentView === 'settings' && <Settings />}
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

      {/* Blocking Shift Manager when no active shift (Only for non-admins or if admin wants to use POS) */}
      <AnimatePresence>
        {!activeShift && userRole === 'staff' && (
          <ShiftManager 
            user={user} 
            onShiftStarted={(shift) => setActiveShift(shift)}
            onShiftClosed={() => setActiveShift(null)}
          />
        )}
      </AnimatePresence>
      {/* Admin Access Key Modal */}
      <AnimatePresence>
        {pendingView && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-sm w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-10 text-center"
            >
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Lock className="w-10 h-10" />
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 mb-2">Acceso Restringido</h3>
              <p className="text-slate-500 font-medium mb-8">Ingresa la clave de acceso para entrar al menú de gestión.</p>

              <form onSubmit={handlePinSubmit} className="space-y-6">
                <div>
                  <input 
                    autoFocus
                    type="password"
                    placeholder="••••"
                    maxLength={4}
                    className={cn(
                      "w-full text-center text-4xl tracking-[1em] py-4 bg-slate-50 border-2 rounded-2xl outline-none transition-all font-black",
                      pinError ? "border-red-500 bg-red-50 text-red-600" : "border-transparent focus:border-indigo-500 focus:bg-white text-slate-900"
                    )}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      if (pinError) setPinError(false);
                    }}
                  />
                  {pinError && (
                    <p className="text-red-500 text-xs font-bold mt-2 uppercase tracking-wider">Clave incorrecta</p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Verificar Clave
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPendingView(null)}
                    className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
