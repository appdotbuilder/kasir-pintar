import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import { 
  Warehouse, 
  AlertTriangle, 
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Search,
  Filter
} from 'lucide-react';
import type { Product, StockMovement, StockAdjustmentInput } from '../../../server/src/schema';

function StockManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [stockThreshold, setStockThreshold] = useState(10);

  // Form state for stock adjustment
  const [adjustmentData, setAdjustmentData] = useState<StockAdjustmentInput>({
    product_id: 0,
    adjustment_quantity: 0,
    notes: null
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [productsData, lowStockData, movementsData] = await Promise.all([
        trpc.getProducts.query(),
        trpc.getLowStockProducts.query({ threshold: stockThreshold }),
        trpc.getStockMovements.query({ productId: selectedProductId || undefined })
      ]);
      
      setProducts(productsData);
      setLowStockProducts(lowStockData);
      setStockMovements(movementsData);
    } catch (error) {
      console.error('Failed to load stock data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [stockThreshold, selectedProductId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustmentData.adjustment_quantity === 0) {
      alert('Jumlah penyesuaian tidak boleh nol');
      return;
    }

    try {
      await trpc.adjustStock.mutate(adjustmentData);
      await loadData();
      setIsAdjustmentOpen(false);
      setAdjustmentData({
        product_id: 0,
        adjustment_quantity: 0,
        notes: null
      });
      alert('Penyesuaian stok berhasil! 📦');
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      alert('Gagal menyesuaikan stok');
    }
  };

  const openAdjustmentDialog = (product: Product) => {
    setAdjustmentData({
      product_id: product.id,
      adjustment_quantity: 0,
      notes: null
    });
    setIsAdjustmentOpen(true);
  };

  const filteredProducts = products.filter((product: Product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchQuery))
  );

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'out': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'adjustment': return <RotateCcw className="h-4 w-4 text-blue-600" />;
      default: return <RotateCcw className="h-4 w-4 text-gray-600" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'in': return 'Masuk';
      case 'out': return 'Keluar';
      case 'adjustment': return 'Penyesuaian';
      default: return type;
    }
  };

  const getReferenceTypeLabel = (type: string) => {
    switch (type) {
      case 'transaction': return 'Transaksi';
      case 'adjustment': return 'Penyesuaian';
      case 'restock': return 'Restock';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">📦 Manajemen Stok</h2>
        
        <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <RotateCcw className="h-4 w-4 mr-2" />
              ⚖️ Sesuaikan Stok
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>⚖️ Penyesuaian Stok</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleStockAdjustment} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Pilih Produk *</label>
                <Select 
                  value={adjustmentData.product_id.toString()} 
                  onValueChange={(value: string) => 
                    setAdjustmentData((prev: StockAdjustmentInput) => ({ 
                      ...prev, 
                      product_id: parseInt(value) 
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih produk untuk disesuaikan" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product: Product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} (Stok: {product.stock_quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Jumlah Penyesuaian *
                </label>
                <Input
                  type="number"
                  value={adjustmentData.adjustment_quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAdjustmentData((prev: StockAdjustmentInput) => ({
                      ...prev,
                      adjustment_quantity: parseInt(e.target.value) || 0
                    }))
                  }
                  placeholder="Positif untuk menambah, negatif untuk mengurangi"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Gunakan angka positif (+) untuk menambah stok, negatif (-) untuk mengurangi
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Catatan</label>
                <Textarea
                  value={adjustmentData.notes || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setAdjustmentData((prev: StockAdjustmentInput) => ({
                      ...prev,
                      notes: e.target.value || null
                    }))
                  }
                  placeholder="Alasan penyesuaian stok..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1" disabled={adjustmentData.product_id === 0}>
                  ⚖️ Sesuaikan Stok
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAdjustmentOpen(false)}
                >
                  ❌ Batal
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">📊 Ringkasan</TabsTrigger>
          <TabsTrigger value="products">📦 Daftar Produk</TabsTrigger>
          <TabsTrigger value="movements">📈 Pergerakan Stok</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Low Stock Alert */}
          <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-2">⚠️ Peringatan Stok Menipis</h3>
                  <p className="text-orange-100">
                    {lowStockProducts.length} produk memerlukan perhatian
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-12 w-12 text-orange-200" />
                  <div className="text-right">
                    <p className="text-3xl font-bold">{lowStockProducts.length}</p>
                    <p className="text-sm text-orange-100">Produk</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock Threshold Settings */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                ⚙️ Pengaturan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Batas minimal stok:</label>
                <Input
                  type="number"
                  value={stockThreshold}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setStockThreshold(parseInt(e.target.value) || 10)
                  }
                  className="w-24"
                  min="1"
                />
                <Button onClick={loadData} variant="outline" size="sm">
                  🔄 Perbarui
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Products List */}
          {lowStockProducts.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  🚨 Produk Stok Menipis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lowStockProducts.map((product: Product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div>
                        <h4 className="font-semibold text-gray-800">{product.name}</h4>
                        <p className="text-sm text-gray-600">
                          Stok tersisa: <span className="font-bold text-red-600">{product.stock_quantity}</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openAdjustmentDialog(product)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Tambah Stok
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          {/* Search */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari produk..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Products Stock Table */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                📋 Stok Produk ({filteredProducts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Memuat data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Harga</TableHead>
                        <TableHead className="text-center">Stok Saat Ini</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product: Product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              {product.barcode && (
                                <code className="text-xs bg-gray-100 px-1 rounded">
                                  {product.barcode}
                                </code>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {product.category ? (
                              <Badge variant="outline">{product.category}</Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            Rp {product.price.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={product.stock_quantity > stockThreshold ? 'secondary' : 
                                      product.stock_quantity > 0 ? 'default' : 'destructive'}
                              className="font-bold"
                            >
                              {product.stock_quantity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {product.stock_quantity <= stockThreshold ? (
                              <Badge variant="destructive">Stok Menipis</Badge>
                            ) : product.stock_quantity <= stockThreshold * 2 ? (
                              <Badge variant="default">Perhatian</Badge>
                            ) : (
                              <Badge variant="secondary">Aman</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAdjustmentDialog(product)}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="space-y-6">
          {/* Product Filter for Movements */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Filter berdasarkan produk:</label>
                <Select 
                  value={selectedProductId?.toString() || 'all'} 
                  onValueChange={(value: string) => 
                    setSelectedProductId(value === 'all' ? null : parseInt(value))
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Produk</SelectItem>
                    {products.map((product: Product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Stock Movements Table */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                📈 Riwayat Pergerakan Stok
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Memuat data...</p>
                </div>
              ) : stockMovements.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Belum ada pergerakan stok</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Produk ID</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead className="text-center">Jumlah</TableHead>
                        <TableHead>Referensi</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockMovements.map((movement: StockMovement) => (
                        <TableRow key={movement.id}>
                          <TableCell>
                            {movement.created_at.toLocaleDateString('id-ID')}
                            <br />
                            <span className="text-xs text-gray-500">
                              {movement.created_at.toLocaleTimeString('id-ID')}
                            </span>
                          </TableCell>
                          <TableCell>#{movement.product_id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getMovementIcon(movement.movement_type)}
                              <span>{getMovementTypeLabel(movement.movement_type)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={movement.movement_type === 'in' ? 'secondary' : 
                                      movement.movement_type === 'out' ? 'destructive' : 'default'}
                            >
                              {movement.movement_type === 'out' ? '-' : '+'}{movement.quantity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getReferenceTypeLabel(movement.reference_type)}
                              {movement.reference_id && ` #${movement.reference_id}`}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {movement.notes ? (
                              <span className="text-sm">{movement.notes}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default StockManagementPage;