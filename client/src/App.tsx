import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  ShoppingCart, 
  Package, 
  Warehouse, 
  FileText,
  Home,
  Calculator
} from 'lucide-react';

// Import page components
import Dashboard from '@/components/Dashboard';
import TransactionPage from '@/components/TransactionPage';
import ProductsPage from '@/components/ProductsPage';
import StockManagementPage from '@/components/StockManagementPage';
import SalesReportPage from '@/components/SalesReportPage';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto p-4">
        {/* Header */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm shadow-lg border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-3">
              <Calculator className="h-8 w-8 text-blue-600" />
              🏪 Aplikasi Kasir Modern
            </CardTitle>
            <p className="text-gray-600 mt-2">Sistem Point of Sale yang mudah dan efisien</p>
          </CardHeader>
        </Card>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6 bg-white/70 backdrop-blur-sm">
            <TabsTrigger 
              value="dashboard" 
              className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="transaction" 
              className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white"
            >
              <ShoppingCart className="h-4 w-4" />
              Transaksi
            </TabsTrigger>
            <TabsTrigger 
              value="products" 
              className="flex items-center gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <Package className="h-4 w-4" />
              Produk
            </TabsTrigger>
            <TabsTrigger 
              value="stock" 
              className="flex items-center gap-2 data-[state=active]:bg-orange-600 data-[state=active]:text-white"
            >
              <Warehouse className="h-4 w-4" />
              Stok
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="flex items-center gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
            >
              <FileText className="h-4 w-4" />
              Laporan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-0">
            <Dashboard />
          </TabsContent>
          
          <TabsContent value="transaction" className="mt-0">
            <TransactionPage />
          </TabsContent>
          
          <TabsContent value="products" className="mt-0">
            <ProductsPage />
          </TabsContent>
          
          <TabsContent value="stock" className="mt-0">
            <StockManagementPage />
          </TabsContent>
          
          <TabsContent value="reports" className="mt-0">
            <SalesReportPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;