import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import { 
  ShoppingCart, 
  Scan, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  Smartphone,
  Receipt,
  FileDown
} from 'lucide-react';
import type { Product, CreateTransactionInput, PaymentMethod, TransactionWithItems } from '../../../server/src/schema';

interface CartItem {
  product: Product;
  quantity: number;
}

function TransactionPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastTransactionPrinted, setLastTransactionPrinted] = useState<TransactionWithItems | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const data = await trpc.getProducts.query();
      setProducts(data.filter((product: Product) => product.is_active));
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) return;
    
    try {
      const product = await trpc.searchProductByBarcode.query({ barcode: barcodeInput });
      if (product) {
        addToCart(product);
        setBarcodeInput('');
      } else {
        alert('Produk dengan barcode tersebut tidak ditemukan');
      }
    } catch (error) {
      console.error('Failed to search barcode:', error);
      alert('Error mencari produk');
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev: CartItem[]) => {
      const existing = prev.find((item: CartItem) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity < product.stock_quantity) {
          return prev.map((item: CartItem) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        } else {
          alert('Stok tidak mencukupi');
          return prev;
        }
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev: CartItem[]) =>
      prev.map((item: CartItem) => {
        if (item.product.id === productId) {
          const maxQuantity = item.product.stock_quantity;
          const quantity = Math.min(newQuantity, maxQuantity);
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev: CartItem[]) => prev.filter((item: CartItem) => item.product.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((total: number, item: CartItem) => total + (item.product.price * item.quantity), 0);
  };

  const calculateChange = () => {
    const total = calculateTotal();
    return paymentMethod === 'cash' ? Math.max(0, paymentAmount - total) : 0;
  };

  const getPaymentMethodLabel = (method: PaymentMethod): string => {
    switch (method) {
      case 'cash': return '💵 Tunai';
      case 'transfer': return '🏦 Transfer';
      case 'e_wallet': return '📱 E-Wallet';
      default: return method;
    }
  };

  const handlePrintReceipt = () => {
    if (!lastTransactionPrinted) {
      alert('Tidak ada transaksi untuk dicetak.');
      return;
    }

    const { transaction_number, created_at, items, total_amount, payment_amount, change_amount, payment_method } = lastTransactionPrinted;

    const receiptContent = `
      <div style="font-family: 'monospace', monospace; width: 300px; padding: 10px; border: 1px solid #ccc; margin: auto;">
        <h2 style="text-align: center; margin-bottom: 10px;">APLIKASI KASIR</h2>
        <p style="text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 10px; margin-bottom: 10px;">
          ------------------------------------
        </p>
        <p>No. Transaksi: <strong>${transaction_number}</strong></p>
        <p>Tanggal: ${new Date(created_at).toLocaleDateString('id-ID')}</p>
        <p>Waktu: ${new Date(created_at).toLocaleTimeString('id-ID')}</p>
        <p style="border-bottom: 1px dashed #ccc; padding-bottom: 10px; margin-bottom: 10px;">
          ------------------------------------
        </p>
        
        <div style="margin-bottom: 10px;">
          ${items.map(item => `
            <div style="display: flex; justify-content: space-between;">
              <span>${item.product_name} x ${item.quantity}</span>
              <span>Rp ${item.total_price.toLocaleString('id-ID')}</span>
            </div>
            <div style="font-size: 0.8em; color: #555; text-align: right;">
              (Rp ${item.unit_price.toLocaleString('id-ID')} / item)
            </div>
          `).join('')}
        </div>
        <p style="border-bottom: 1px dashed #ccc; padding-bottom: 10px; margin-bottom: 10px;">
          ------------------------------------
        </p>
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px;">
          <span>TOTAL:</span>
          <span>Rp ${total_amount.toLocaleString('id-ID')}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Metode Bayar:</span>
          <span>${getPaymentMethodLabel(payment_method)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Dibayar:</span>
          <span>Rp ${payment_amount.toLocaleString('id-ID')}</span>
        </div>
        ${change_amount > 0 ? `
        <div style="display: flex; justify-content: space-between; font-weight: bold; color: green; margin-top: 5px;">
          <span>Kembalian:</span>
          <span>Rp ${change_amount.toLocaleString('id-ID')}</span>
        </div>
        ` : ''}
        <p style="border-top: 1px dashed #ccc; padding-top: 10px; margin-top: 10px; text-align: center;">
          Terima Kasih Telah Berbelanja!
        </p>
      </div>
    `;

    const printWindow = window.open('', '_blank', 'height=600,width=400');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Struk Transaksi</title>');
      printWindow.document.write('<style>');
      printWindow.document.write(`
        body { margin: 0; padding: 0; font-size: 12px; }
        .print-only { display: block; }
        .no-print { display: none !important; }
        @page { size: auto; margin: 10mm; }
        h2 { font-size: 1.2em; }
      `);
      printWindow.document.write('</style></head><body>');
      printWindow.document.write(receiptContent);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      alert('Gagal membuka jendela cetak. Pastikan pop-up diizinkan.');
    }
  };

  const handleTransaction = async () => {
    if (cart.length === 0) {
      alert('Keranjang kosong');
      return;
    }

    const total = calculateTotal();
    if (paymentMethod === 'cash' && paymentAmount < total) {
      alert('Jumlah pembayaran tidak mencukupi');
      return;
    }

    setIsLoading(true);
    try {
      const transactionData: CreateTransactionInput = {
        items: cart.map((item: CartItem) => ({
          product_id: item.product.id,
          quantity: item.quantity
        })),
        payment_method: paymentMethod,
        payment_amount: paymentMethod === 'cash' ? paymentAmount : total,
        notes: notes || null
      };

      const completedTransaction = await trpc.createTransaction.mutate(transactionData);
      setLastTransactionPrinted(completedTransaction);
      
      // Reset form
      setCart([]);
      setPaymentAmount(0);
      setNotes('');
      setBarcodeInput('');
      
      // Reload products to update stock
      loadProducts();
      
      alert('Transaksi berhasil! 🥳');
    } catch (error) {
      console.error('Failed to create transaction:', error);
      setLastTransactionPrinted(null);
      alert('Gagal membuat transaksi');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter((product: Product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchQuery))
  );

  const total = calculateTotal();
  const change = calculateChange();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Product Selection */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              🛒 Pilih Produk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Barcode Scanner */}
            <div className="flex gap-2">
              <Input
                placeholder="Scan barcode atau ketik manual"
                value={barcodeInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBarcodeInput(e.target.value)}
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') handleBarcodeSearch();
                }}
              />
              <Button onClick={handleBarcodeSearch} variant="outline">
                <Scan className="h-4 w-4" />
              </Button>
            </div>

            {/* Product Search */}
            <Input
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product: Product) => (
                <Card 
                  key={product.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-1 truncate">{product.name}</h3>
                    <p className="text-lg font-bold text-green-600 mb-2">
                      Rp {product.price.toLocaleString('id-ID')}
                    </p>
                    <div className="flex justify-between items-center">
                      <Badge variant={product.stock_quantity > 0 ? 'secondary' : 'destructive'}>
                        Stok: {product.stock_quantity}
                      </Badge>
                      <Button size="sm" variant="ghost">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Cart and Checkout */}
      <div className="space-y-6">
        {/* Shopping Cart */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              🛍️ Keranjang ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Keranjang masih kosong</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item: CartItem) => (
                  <div key={item.product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.product.name}</h4>
                      <p className="text-sm text-gray-600">
                        Rp {item.product.price.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment */}
        {cart.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                💳 Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment Method */}
              <div>
                <label className="text-sm font-medium mb-2 block">Metode Pembayaran</label>
                <Select value={paymentMethod} onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        💵 Tunai
                      </div>
                    </SelectItem>
                    <SelectItem value="transfer">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        🏦 Transfer
                      </div>
                    </SelectItem>
                    <SelectItem value="e_wallet">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        📱 E-Wallet
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Amount (for cash) */}
              {paymentMethod === 'cash' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Jumlah Bayar</label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    step="1000"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-2 block">Catatan (Opsional)</label>
                <Textarea
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                  placeholder="Tambahkan catatan..."
                  rows={2}
                />
              </div>

              <Separator />

              {/* Total Summary */}
              <div className="space-y-2">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>Rp {total.toLocaleString('id-ID')}</span>
                </div>
                
                {paymentMethod === 'cash' && paymentAmount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>Bayar:</span>
                      <span>Rp {paymentAmount.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Kembalian:</span>
                      <span>Rp {change.toLocaleString('id-ID')}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleTransaction}
                  disabled={isLoading || cart.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? '⏳ Proses...' : '✅ Bayar'}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={handlePrintReceipt}
                  disabled={isLoading || !lastTransactionPrinted}
                >
                  <Receipt className="h-4 w-4 mr-1" />
                  📄 Cetak Struk
                </Button>
              </div>
              
              <Button 
                variant="ghost" 
                className="w-full" 
                onClick={handlePrintReceipt}
                disabled={isLoading || !lastTransactionPrinted}
              >
                <FileDown className="h-4 w-4 mr-1" />
                💾 Simpan PDF
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default TransactionPage;