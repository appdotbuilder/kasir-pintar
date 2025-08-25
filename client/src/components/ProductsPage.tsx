import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/utils/trpc';
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Eye,
  EyeOff
} from 'lucide-react';
import type { Product, CreateProductInput, UpdateProductInput } from '../../../server/src/schema';

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateProductInput>({
    name: '',
    description: null,
    barcode: null,
    price: 0,
    stock_quantity: 0,
    category: null,
    is_active: true
  });

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await trpc.getProducts.query();
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: null,
      barcode: null,
      price: 0,
      stock_quantity: 0,
      category: null,
      is_active: true
    });
    setEditingProduct(null);
  };

  const handleOpenForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description,
        barcode: product.barcode,
        price: product.price,
        stock_quantity: product.stock_quantity,
        category: product.category,
        is_active: product.is_active
      });
    } else {
      resetForm();
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingProduct) {
        // Update product
        const updateData: UpdateProductInput = {
          id: editingProduct.id,
          name: formData.name,
          description: formData.description,
          barcode: formData.barcode,
          price: formData.price,
          stock_quantity: formData.stock_quantity,
          category: formData.category,
          is_active: formData.is_active
        };
        
        await trpc.updateProduct.mutate(updateData);
      } else {
        // Create product
        await trpc.createProduct.mutate(formData);
      }

      await loadProducts();
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save product:', error);
      alert('Gagal menyimpan produk');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (productId: number) => {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;

    try {
      await trpc.deleteProduct.mutate({ id: productId });
      await loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert('Gagal menghapus produk');
    }
  };

  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (product.barcode && product.barcode.includes(searchQuery)) ||
                         (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesActiveFilter = showInactive || product.is_active;
    return matchesSearch && matchesActiveFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">📦 Data Produk</h2>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenForm()} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              ➕ Tambah Produk
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? '✏️ Edit Produk' : '➕ Tambah Produk Baru'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Nama Produk *</label>
                <Input
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateProductInput) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Masukkan nama produk"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Deskripsi</label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev: CreateProductInput) => ({
                      ...prev,
                      description: e.target.value || null
                    }))
                  }
                  placeholder="Deskripsi produk (opsional)"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Barcode</label>
                <Input
                  value={formData.barcode || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateProductInput) => ({
                      ...prev,
                      barcode: e.target.value || null
                    }))
                  }
                  placeholder="Scan atau ketik barcode"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Harga *</label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateProductInput) => ({
                        ...prev,
                        price: parseFloat(e.target.value) || 0
                      }))
                    }
                    placeholder="0"
                    step="500"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Stok *</label>
                  <Input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateProductInput) => ({
                        ...prev,
                        stock_quantity: parseInt(e.target.value) || 0
                      }))
                    }
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Kategori</label>
                <Input
                  value={formData.category || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateProductInput) => ({
                      ...prev,
                      category: e.target.value || null
                    }))
                  }
                  placeholder="Kategori produk (opsional)"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Produk Aktif</label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked: boolean) =>
                    setFormData((prev: CreateProductInput) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? '⏳ Menyimpan...' : (editingProduct ? '💾 Update' : '➕ Tambah')}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsFormOpen(false)}
                  disabled={isLoading}
                >
                  ❌ Batal
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari nama produk, barcode, atau kategori..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={showInactive}
                onCheckedChange={setShowInactive}
                id="show-inactive"
              />
              <label htmlFor="show-inactive" className="text-sm cursor-pointer">
                Tampilkan tidak aktif
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              📋 Daftar Produk ({filteredProducts.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Memuat data...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Tidak ada produk yang ditemukan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product: Product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-gray-500 truncate max-w-48">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {product.barcode || '-'}
                        </code>
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
                      <TableCell className="text-right">
                        <Badge 
                          variant={product.stock_quantity > 10 ? 'secondary' : 
                                  product.stock_quantity > 0 ? 'default' : 'destructive'}
                        >
                          {product.stock_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {product.is_active ? (
                            <>
                              <Eye className="h-4 w-4 text-green-600" />
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                Aktif
                              </Badge>
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-4 w-4 text-gray-400" />
                              <Badge variant="outline" className="text-gray-500">
                                Nonaktif
                              </Badge>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenForm(product)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ProductsPage;