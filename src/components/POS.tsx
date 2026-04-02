import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Smartphone,
  CheckCircle2,
  Printer,
  X
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatCurrency, cn, handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  stock: number;
}

interface CartItem extends Product {
  quantity: number;
}

export default function POS({ user, activeShift }: { user: any, activeShift: any }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit_card' | 'debit_card' | 'transfer' | 'other'>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [lastSaleId, setLastSaleId] = useState('');
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach(doc => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    // Auto-focus search input on mount
    searchInputRef.current?.focus();

    return () => unsubscribe();
  }, []);

  // Barcode scanner auto-add logic
  useEffect(() => {
    if (searchTerm.length >= 3) {
      const exactMatch = products.find(p => p.barcode === searchTerm);
      if (exactMatch) {
        addToCart(exactMatch);
        setSearchTerm('');
      }
    }
  }, [searchTerm, products]);

  // Global keydown listener to focus search input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't focus if we are in another input or modal is open
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA' ||
        isSuccessModalOpen ||
        isPreviewModalOpen
      ) return;

      // Focus search input on any alphanumeric key
      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSuccessModalOpen, isPreviewModalOpen]);

  const addToCart = (product: Product) => {
    const effectiveStock = getEffectiveStock(product);
    if (effectiveStock <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        if (newQty > item.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxRate = 0.21; // 21% IVA placeholder
  const subtotal = total / (1 + taxRate);
  const taxAmount = total - subtotal;
  const change = paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0;

  const getEffectiveStock = (product: Product) => {
    const cartItem = cart.find(item => item.id === product.id);
    return product.stock - (cartItem?.quantity || 0);
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0 || !activeShift) return;

    const saleData = {
      items: cart.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        cost: item.cost || 0,
        subtotal: item.price * item.quantity
      })),
      total,
      paymentMethod,
      amountPaid: paymentMethod === 'cash' ? amountPaid : total,
      change: paymentMethod === 'cash' ? change : 0,
      timestamp: Timestamp.now(),
      userId: user.uid,
      shiftId: activeShift.id,
      cashierName: activeShift.cashierName
    };

    try {
      // 1. Create Sale Record
      const saleRef = await addDoc(collection(db, 'sales'), saleData);
      
      // 2. Update Stock for each item
      for (const item of cart) {
        await updateDoc(doc(db, 'products', item.id), {
          stock: increment(-item.quantity)
        });
      }

      // 3. Update Shift total sales and cash sales if applicable
      const shiftUpdate: any = {
        totalSales: increment(total)
      };
      if (paymentMethod === 'cash') {
        shiftUpdate.cashSales = increment(total);
      }
      await updateDoc(doc(db, 'shifts', activeShift.id), shiftUpdate);

      setLastSaleId(saleRef.id);
      setLastSaleData(saleData);
      setIsSuccessModalOpen(true);
      setIsPreviewModalOpen(false);
      setCart([]);
      setAmountPaid(0);
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, 'POS operations');
      }
      console.error("Error completing sale:", error);
    }
  };

  const handlePrintReceipt = () => {
    if (!lastSaleData) return;
    window.print();
  };

  const filteredProducts = searchTerm.length > 0 
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.includes(searchTerm)
      )
    : products; // Show all products by default

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col lg:flex-row gap-6">
      {/* Left: Product Selection */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-600" />
            Buscar Productos
          </h2>
          <div className="relative">
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Escanea código o escribe nombre..." 
              className="w-full pl-4 pr-12 py-4 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredProducts.length === 1) {
                  addToCart(filteredProducts[0]);
                }
              }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
              <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold">ENTER</kbd>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredProducts.map(product => {
              const effectiveStock = getEffectiveStock(product);
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={effectiveStock <= 0}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all text-left group",
                    effectiveStock > 0 
                      ? "bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30" 
                      : "bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{product.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{product.barcode || 'S/C'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-indigo-600">{formatCurrency(product.price)}</p>
                    <p className={cn(
                      "text-[10px] font-bold uppercase",
                      effectiveStock <= 5 ? "text-amber-600" : "text-slate-400"
                    )}>
                      Stock: {effectiveStock}
                    </p>
                  </div>
                </button>
              );
            })}
            {searchTerm.length > 0 && filteredProducts.length === 0 && (
              <div className="col-span-full py-8 text-center text-slate-400 italic">
                No se encontraron productos con ese nombre o código.
              </div>
            )}
            {searchTerm.length === 0 && filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-400 font-medium">No hay productos en el inventario.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Access / Categories could go here */}
        <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <h3 className="font-bold text-slate-900 mb-4">Acceso Rápido</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto pr-2">
            {products.slice(0, 12).map(product => {
              const effectiveStock = getEffectiveStock(product);
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={effectiveStock <= 0}
                  className={cn(
                    "p-3 rounded-xl text-center transition-colors border",
                    effectiveStock > 0
                      ? "bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border-transparent hover:border-indigo-100"
                      : "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed"
                  )}
                >
                  <p className="text-xs font-bold truncate">{product.name}</p>
                  <p className="text-xs font-medium opacity-70">{formatCurrency(product.price)}</p>
                  <p className="text-[9px] font-bold text-slate-400">Stock: {effectiveStock}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Cart & Checkout */}
      <div className="w-full lg:w-96 flex flex-col gap-6">
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              Carrito
            </h2>
            <span className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg text-xs font-bold">
              {cart.length} items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map(item => (
              <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 group">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-slate-900 text-sm truncate pr-4">{item.name}</p>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 hover:bg-slate-50 rounded text-slate-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 hover:bg-slate-50 rounded text-slate-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="font-bold text-slate-900">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">El carrito está vacío</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-slate-500 text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-slate-900 text-xl font-bold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'cash', icon: Banknote, label: 'Efectivo' },
                { id: 'credit_card', icon: CreditCard, label: 'T. Crédito' },
                { id: 'debit_card', icon: CreditCard, label: 'T. Débito' },
                { id: 'transfer', icon: Smartphone, label: 'Transf.' },
                { id: 'other', icon: CheckCircle2, label: 'Otro' }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all",
                    paymentMethod === method.id 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200" 
                      : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
                  )}
                >
                  <method.icon className="w-5 h-5" />
                  <span className="text-[8px] font-bold uppercase truncate w-full">{method.label}</span>
                </button>
              ))}
            </div>

            <button 
              onClick={() => setIsPreviewModalOpen(true)}
              disabled={cart.length === 0}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              Completar Venta
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Preview Modal */}
      <AnimatePresence>
        {isPreviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsPreviewModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">Resumen de Venta</h3>
                <button 
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Items List */}
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-slate-600">
                        <span className="font-bold text-slate-900">{item.quantity}x</span> {item.name}
                      </span>
                      <span className="font-medium text-slate-900">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-slate-100" />

                {/* Totals Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-slate-500 text-sm">
                    <span>Subtotal (Neto)</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-sm">
                    <span>IVA (21%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 text-2xl font-black pt-2">
                    <span>Total a Pagar</span>
                    <span className="text-indigo-600">{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Payment Method Confirmation */}
                <div className="space-y-4">
                  <div className="bg-indigo-50 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        {paymentMethod === 'cash' && <Banknote className="w-5 h-5 text-indigo-600" />}
                        {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && <CreditCard className="w-5 h-5 text-indigo-600" />}
                        {paymentMethod === 'transfer' && <Smartphone className="w-5 h-5 text-indigo-600" />}
                        {paymentMethod === 'other' && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                      </div>
                      <div>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase leading-none">Método de Pago</p>
                        <p className="text-sm font-bold text-indigo-900">
                          {paymentMethod === 'cash' && 'Efectivo'}
                          {paymentMethod === 'credit_card' && 'Tarjeta de Crédito'}
                          {paymentMethod === 'debit_card' && 'Tarjeta de Débito'}
                          {paymentMethod === 'transfer' && 'Transferencia'}
                          {paymentMethod === 'other' && 'Otro'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsPreviewModalOpen(false)}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Cambiar
                    </button>
                  </div>

                  {paymentMethod === 'cash' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Monto Recibido</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                          <input 
                            type="number" 
                            className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg"
                            placeholder="0.00"
                            value={amountPaid || ''}
                            onChange={(e) => setAmountPaid(Number(e.target.value))}
                            autoFocus
                          />
                        </div>
                      </div>
                      {amountPaid >= total && (
                        <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <span className="text-sm font-bold text-emerald-700">Vuelto:</span>
                          <span className="text-lg font-black text-emerald-700">{formatCurrency(change)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={handleCompleteSale}
                  disabled={paymentMethod === 'cash' && amountPaid < total}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Confirmar y Registrar Venta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {isSuccessModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">¡Venta Exitosa!</h3>
              <p className="text-slate-500 mb-6">La transacción ha sido registrada correctamente.</p>
              <div className="bg-slate-50 p-4 rounded-2xl mb-8 text-left">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">ID Venta:</span>
                  <span className="font-mono text-slate-900">#{lastSaleId.slice(-6).toUpperCase()}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span className="text-slate-900">Total:</span>
                  <span className="text-indigo-600">{formatCurrency(lastSaleData?.total || 0)}</span>
                </div>
                {lastSaleData?.paymentMethod === 'cash' && (
                  <div className="flex justify-between text-sm mt-2 pt-2 border-t border-slate-100">
                    <span className="text-slate-500">Vuelto entregado:</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(lastSaleData.change || 0)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handlePrintReceipt}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Imprimir Recibo
                </button>
                <button 
                  onClick={() => setIsSuccessModalOpen(false)}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-colors"
                >
                  Nueva Venta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Printable Receipt */}
      {lastSaleData && (
        <div id="printable-receipt" className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 text-black font-mono text-sm">
          <div className="max-w-[300px] mx-auto space-y-4">
            <div className="text-center border-b border-dashed border-black pb-4">
              <h1 className="text-xl font-bold uppercase">Minimark AyB</h1>
              <p className="text-xs">¡Gracias por su compra!</p>
              <p className="text-[10px] mt-1">{lastSaleData.timestamp?.toDate().toLocaleString('es-AR')}</p>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between font-bold border-b border-dashed border-black pb-1 mb-1">
                <span>Producto</span>
                <span>Subtotal</span>
              </div>
              {lastSaleData.items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-[10px]">
                  <span className="truncate pr-2">{item.quantity}x {item.name}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-black pt-2 space-y-1">
              <div className="flex justify-between font-bold text-base">
                <span>TOTAL</span>
                <span>{formatCurrency(lastSaleData.total)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Método:</span>
                <span className="uppercase">{lastSaleData.paymentMethod}</span>
              </div>
              {lastSaleData.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span>Recibido:</span>
                    <span>{formatCurrency(lastSaleData.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Vuelto:</span>
                    <span>{formatCurrency(lastSaleData.change)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center pt-4 border-t border-dashed border-black">
              <p className="text-[10px]">Cajero: {lastSaleData.cashierName}</p>
              <p className="text-[8px] mt-1">ID: {lastSaleId}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
