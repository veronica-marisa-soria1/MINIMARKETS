import React, { useState, useEffect } from 'react';
import { Users, Shield, ShieldCheck, Search, Mail, Trash2, UserPlus, Filter, CheckCircle2, Clock, UserCog } from 'lucide-react';
import { collection, onSnapshot, query, updateDoc, doc, deleteDoc, setDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'staff';
  authorized?: boolean;
}

type FilterType = 'all' | 'admins' | 'staff' | 'pending';

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'staff'>('staff');
  const [loading, setLoading] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'delete' | 'role' | 'auth' | null;
    user: UserProfile | null;
    title: string;
    message: string;
    confirmText: string;
    confirmColor: string;
  }>({
    isOpen: false,
    type: null,
    user: null,
    title: '',
    message: '',
    confirmText: '',
    confirmColor: ''
  });
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserProfile[] = [];
      snapshot.forEach(doc => {
        usersData.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;

    setLoading(true);
    try {
      // Check if user already exists
      const q = query(collection(db, 'users'), where('email', '==', newUserEmail.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        alert("Este usuario ya existe en el sistema.");
        setLoading(false);
        return;
      }

      // Create a temporary ID or use email as ID if they haven't logged in yet
      // But Firebase Auth UIDs are better. For pre-auth, we can use a doc with email as ID 
      // and then merge it when they log in, OR just use a random ID.
      // The current App.tsx logic uses user.uid as ID. 
      // If we pre-authorize, we should probably store it by email and have App.tsx check by email.
      
      // Let's use a random ID for now, App.tsx will need to be updated to check for pre-auth by email.
      const tempId = `pre_${Date.now()}`;
      await setDoc(doc(db, 'users', tempId), {
        email: newUserEmail.trim(),
        role: newUserRole,
        authorized: true,
        preAuthorized: true
      });

      setIsAddModalOpen(false);
      setNewUserEmail('');
      setNewUserRole('staff');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (user: UserProfile) => {
    const newRole = user.role === 'admin' ? 'staff' : 'admin';
    setConfirmModal({
      isOpen: true,
      type: 'role',
      user,
      title: '¿Cambiar Rol?',
      message: `¿Estás seguro de cambiar el rol de ${user.email} a ${newRole === 'admin' ? 'Administrador' : 'Cajero'}?`,
      confirmText: 'Sí, Cambiar Rol',
      confirmColor: 'bg-indigo-600 hover:bg-indigo-700'
    });
  };

  const toggleAuth = (user: UserProfile) => {
    const newStatus = !user.authorized;
    setConfirmModal({
      isOpen: true,
      type: 'auth',
      user,
      title: newStatus ? '¿Autorizar Acceso?' : '¿Revocar Acceso?',
      message: `¿Estás seguro de ${newStatus ? 'autorizar' : 'revocar'} el acceso a ${user.email}?`,
      confirmText: newStatus ? 'Sí, Autorizar' : 'Sí, Revocar',
      confirmColor: newStatus ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
    });
  };

  const deleteUser = (user: UserProfile) => {
    if (user.email === "soriav449veronica@gmail.com") {
      // We could use a custom alert modal here too, but for now let's just use a simple check
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      user,
      title: '¿Eliminar Usuario?',
      message: `¿Estás seguro de eliminar permanentemente a ${user.email}? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, Eliminar',
      confirmColor: 'bg-red-600 hover:bg-red-700'
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.user || !confirmModal.type || isActionLoading) return;

    setIsActionLoading(true);
    try {
      const user = confirmModal.user;
      if (confirmModal.type === 'role') {
        const newRole = user.role === 'admin' ? 'staff' : 'admin';
        await updateDoc(doc(db, 'users', user.id), { role: newRole });
      } else if (confirmModal.type === 'auth') {
        await updateDoc(doc(db, 'users', user.id), { authorized: !user.authorized });
      } else if (confirmModal.type === 'delete') {
        await deleteDoc(doc(db, 'users', user.id));
      }
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${confirmModal.user.id}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeFilter === 'admins') return matchesSearch && u.role === 'admin';
    if (activeFilter === 'staff') return matchesSearch && u.role === 'staff';
    if (activeFilter === 'pending') return matchesSearch && !u.authorized;
    return matchesSearch;
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    staff: users.filter(u => u.role === 'staff').length,
    pending: users.filter(u => !u.authorized).length
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestión de Personal</h2>
          <p className="text-slate-500 font-medium">Administra el acceso y roles de tu equipo.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <UserPlus className="w-5 h-5" />
          Agregar Usuario
        </button>
      </div>

      {/* Stats Cards / Menu */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { id: 'all', label: 'Todos', count: stats.total, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { id: 'admins', label: 'Admins', count: stats.admins, icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
          { id: 'staff', label: 'Cajeros', count: stats.staff, icon: UserCog, color: 'text-blue-600', bg: 'bg-blue-50' },
          { id: 'pending', label: 'Pendientes', count: stats.pending, icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveFilter(item.id as FilterType)}
            className={cn(
              "p-4 rounded-3xl border-2 transition-all text-left group",
              activeFilter === item.id 
                ? "border-indigo-600 bg-white shadow-md" 
                : "border-transparent bg-white hover:border-slate-200"
            )}
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", item.bg, item.color)}>
              <item.icon className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
            <p className="text-2xl font-black text-slate-900">{item.count}</p>
          </button>
        ))}
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o email..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl text-slate-500 text-sm font-bold">
          <Filter className="w-4 h-4" />
          Filtrando: {activeFilter === 'all' ? 'Todos' : activeFilter === 'admins' ? 'Administradores' : activeFilter === 'staff' ? 'Cajeros' : 'Pendientes'}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Personal</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Contacto</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Rol</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-sm border border-indigo-100">
                        {user.displayName?.[0] || user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="block text-sm font-bold text-slate-900">{user.displayName || 'Sin nombre'}</span>
                        {user.id.startsWith('pre_') && (
                          <span className="text-[10px] font-bold text-amber-500 uppercase">Pre-autorizado</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                      <Mail className="w-4 h-4 text-slate-300" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider",
                      user.authorized 
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                        : "bg-red-50 text-red-600 border border-red-100"
                    )}>
                      {user.authorized ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {user.authorized ? 'Activo' : 'Pendiente'}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider",
                      user.role === 'admin' 
                        ? "bg-amber-50 text-amber-600 border border-amber-100" 
                        : "bg-blue-50 text-blue-600 border border-blue-100"
                    )}>
                      {user.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                      {user.role === 'admin' ? 'Administrador' : 'Cajero'}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleAuth(user)}
                        className={cn(
                          "p-2.5 rounded-xl transition-all",
                          user.authorized 
                            ? "text-red-400 hover:bg-red-50 hover:text-red-600" 
                            : "text-emerald-400 hover:bg-emerald-50 hover:text-emerald-600"
                        )}
                        title={user.authorized ? "Revocar Acceso" : "Dar Acceso"}
                      >
                        <Shield className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => toggleRole(user)}
                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Cambiar Rol"
                      >
                        <ShieldCheck className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => deleteUser(user)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar Usuario"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-slate-200" />
            </div>
            <p className="text-slate-400 font-bold text-lg">No se encontraron resultados</p>
            <p className="text-slate-300 text-sm mt-1">Intenta con otros criterios de búsqueda o filtros.</p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-indigo-600 p-10 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
                    <UserPlus className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-3xl font-black tracking-tight">Nuevo Usuario</h3>
                  <p className="text-indigo-100 font-medium mt-2">Pre-autoriza el acceso de un nuevo integrante.</p>
                </div>
              </div>

              <form onSubmit={handleAddUser} className="p-10 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Email del Usuario</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        required
                        type="email" 
                        placeholder="ejemplo@correo.com"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-900"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Rol Asignado</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNewUserRole('staff')}
                        className={cn(
                          "py-4 rounded-2xl font-bold text-sm transition-all border-2",
                          newUserRole === 'staff' 
                            ? "bg-indigo-50 border-indigo-600 text-indigo-600" 
                            : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        Cajero
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewUserRole('admin')}
                        className={cn(
                          "py-4 rounded-2xl font-bold text-sm transition-all border-2",
                          newUserRole === 'admin' 
                            ? "bg-amber-50 border-amber-600 text-amber-600" 
                            : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        Administrador
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Autorizar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-sm w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className={cn(
                "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6",
                confirmModal.type === 'delete' ? "bg-red-50 text-red-600" : 
                confirmModal.type === 'role' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
              )}>
                {confirmModal.type === 'delete' ? <Trash2 className="w-10 h-10" /> : 
                 confirmModal.type === 'role' ? <Shield className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 font-medium mb-8">{confirmModal.message}</p>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleConfirmAction}
                  disabled={isActionLoading}
                  className={cn(
                    "w-full py-4 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2",
                    confirmModal.confirmColor
                  )}
                >
                  {isActionLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : confirmModal.confirmText}
                </button>
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={isActionLoading}
                  className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
