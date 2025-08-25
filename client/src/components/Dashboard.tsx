import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { 
  TrendingUp, 
  ShoppingBag, 
  AlertTriangle, 
  DollarSign,
  Package,
  Star,
  ShoppingCart
} from 'lucide-react';
import type { DashboardStats } from '../../../server/src/schema';

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await trpc.getDashboardStats.query();
      setStats(data);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardStats, 30000);
    return () => clearInterval(interval);
  }, [loadDashboardStats]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded mb-4"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">📊 Dashboard</h2>
        <Badge variant="outline" className="text-sm">
          Auto-refresh setiap 30 detik
        </Badge>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Penjualan Hari Ini</p>
                <p className="text-3xl font-bold">
                  Rp {stats ? stats.total_sales_today.toLocaleString('id-ID') : '0'}
                </p>
              </div>
              <DollarSign className="h-12 w-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Transaksi Hari Ini</p>
                <p className="text-3xl font-bold">{stats?.total_transactions_today || 0}</p>
              </div>
              <ShoppingBag className="h-12 w-12 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Stok Menipis</p>
                <p className="text-3xl font-bold">{stats?.low_stock_products || 0}</p>
              </div>
              <AlertTriangle className="h-12 w-12 text-orange-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Omset Bulan Ini</p>
                <p className="text-3xl font-bold">
                  Rp {stats ? stats.total_revenue_month.toLocaleString('id-ID') : '0'}
                </p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Selling Products */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            🏆 Produk Terlaris
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.top_selling_products.length ? (
            <div className="space-y-4">
              {stats.top_selling_products.map((product, index) => (
                <div key={product.product_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="h-8 w-8 rounded-full flex items-center justify-center">
                      #{index + 1}
                    </Badge>
                    <div>
                      <p className="font-semibold text-gray-800">{product.product_name}</p>
                      <p className="text-sm text-gray-600">{product.total_sold} unit terjual</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      Rp {product.revenue.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-gray-500">Total omset</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Belum ada data produk terlaris</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>⚡ Aksi Cepat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-blue-50 border-blue-200">
              <CardContent className="p-4 text-center">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <p className="text-sm font-medium">Transaksi Baru</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="text-sm font-medium">Tambah Produk</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-orange-50 border-orange-200">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <p className="text-sm font-medium">Cek Stok</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-purple-50 border-purple-200">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <p className="text-sm font-medium">Lihat Laporan</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;