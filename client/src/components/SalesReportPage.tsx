import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { trpc } from '@/utils/trpc';
import { 
  FileText, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag,
  Calendar as CalendarIcon,
  Download,
  Filter,
  BarChart3,
  Eye
} from 'lucide-react';
import type { SalesReport, Transaction, TransactionWithItems, SalesReportInput } from '../../../server/src/schema';

function SalesReportPage() {
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Report filters
  const [reportFilters, setReportFilters] = useState<SalesReportInput>({
    period: 'daily',
    start_date: undefined,
    end_date: undefined
  });

  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      const data = await trpc.getTransactions.query();
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const loadSalesReport = async () => {
    setIsLoading(true);
    try {
      const filters: SalesReportInput = {
        period: reportFilters.period,
        start_date: customStartDate,
        end_date: customEndDate
      };
      
      const data = await trpc.getSalesReport.query(filters);
      setSalesReport(data);
    } catch (error) {
      console.error('Failed to load sales report:', error);
      alert('Gagal memuat laporan penjualan');
    } finally {
      setIsLoading(false);
    }
  };

  const viewTransactionDetails = async (transactionId: number) => {
    try {
      const details = await trpc.getTransactionDetails.query({ id: transactionId });
      setSelectedTransaction(details);
      setIsDetailOpen(true);
    } catch (error) {
      console.error('Failed to load transaction details:', error);
      alert('Gagal memuat detail transaksi');
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return '💵 Tunai';
      case 'transfer': return '🏦 Transfer';
      case 'e_wallet': return '📱 E-Wallet';
      default: return method;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">✅ Selesai</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">⏳ Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">❌ Dibatal</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">📊 Laporan Penjualan</h2>
      </div>

      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reports">📈 Laporan Ringkasan</TabsTrigger>
          <TabsTrigger value="transactions">📋 Daftar Transaksi</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-6">
          {/* Report Filters */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                🔍 Filter Laporan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Periode</label>
                  <Select
                    value={reportFilters.period}
                    onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                      setReportFilters((prev: SalesReportInput) => ({ ...prev, period: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">📅 Harian</SelectItem>
                      <SelectItem value="weekly">📅 Mingguan</SelectItem>
                      <SelectItem value="monthly">📅 Bulanan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Tanggal Mulai</label>
                  <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? customStartDate.toLocaleDateString('id-ID') : 'Pilih tanggal'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={(date: Date | undefined) => {
                          setCustomStartDate(date);
                          setIsStartDateOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Tanggal Selesai</label>
                  <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? customEndDate.toLocaleDateString('id-ID') : 'Pilih tanggal'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={(date: Date | undefined) => {
                          setCustomEndDate(date);
                          setIsEndDateOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={loadSalesReport} disabled={isLoading}>
                  {isLoading ? '⏳ Memuat...' : '📊 Generate Laporan'}
                </Button>
                <Button variant="outline" disabled={!salesReport}>
                  <Download className="h-4 w-4 mr-2" />
                  💾 Export PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales Report Summary */}
          {salesReport && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm">Total Penjualan</p>
                        <p className="text-3xl font-bold">
                          Rp {salesReport.total_sales.toLocaleString('id-ID')}
                        </p>
                      </div>
                      <DollarSign className="h-12 w-12 text-green-200" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm">Total Transaksi</p>
                        <p className="text-3xl font-bold">{salesReport.total_transactions}</p>
                      </div>
                      <ShoppingBag className="h-12 w-12 text-blue-200" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm">Rata-rata per Transaksi</p>
                        <p className="text-3xl font-bold">
                          Rp {salesReport.average_transaction.toLocaleString('id-ID')}
                        </p>
                      </div>
                      <BarChart3 className="h-12 w-12 text-purple-200" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Report Details */}
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    📋 Detail Laporan ({salesReport.period})
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Periode: {salesReport.start_date.toLocaleDateString('id-ID')} - {salesReport.end_date.toLocaleDateString('id-ID')}
                  </p>
                </CardHeader>
                <CardContent>
                  {salesReport.transactions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>Tidak ada transaksi dalam periode ini</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>No. Transaksi</TableHead>
                            <TableHead>Tanggal & Waktu</TableHead>
                            <TableHead>Metode Pembayaran</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesReport.transactions.map((transaction: Transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                                  {transaction.transaction_number}
                                </code>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">
                                    {transaction.created_at.toLocaleDateString('id-ID')}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {transaction.created_at.toLocaleTimeString('id-ID')}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                {getPaymentMethodLabel(transaction.payment_method)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                Rp {transaction.total_amount.toLocaleString('id-ID')}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(transaction.status)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => viewTransactionDetails(transaction.id)}
                                >
                                  <Eye className="h-3 w-3" />
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
            </>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          {/* All Transactions Table */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                🛍️ Semua Transaksi ({transactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Belum ada transaksi</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. Transaksi</TableHead>
                        <TableHead>Tanggal & Waktu</TableHead>
                        <TableHead>Metode Pembayaran</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Dibayar</TableHead>
                        <TableHead className="text-right">Kembalian</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction: Transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                              {transaction.transaction_number}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {transaction.created_at.toLocaleDateString('id-ID')}
                              </p>
                              <p className="text-sm text-gray-500">
                                {transaction.created_at.toLocaleTimeString('id-ID')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getPaymentMethodLabel(transaction.payment_method)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            Rp {transaction.total_amount.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right">
                            Rp {transaction.payment_amount.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right">
                            {transaction.change_amount > 0 && (
                              <span className="text-green-600 font-medium">
                                Rp {transaction.change_amount.toLocaleString('id-ID')}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(transaction.status)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewTransactionDetails(transaction.id)}
                            >
                              <Eye className="h-3 w-3" />
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
      </Tabs>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className={`fixed inset-0 bg-black/50 z-50 ${isDetailOpen ? 'block' : 'hidden'}`}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>🧾 Detail Transaksi</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDetailOpen(false)}
                  >
                    ❌ Tutup
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Transaction Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">No. Transaksi</p>
                    <p className="font-semibold">{selectedTransaction.transaction_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    {getStatusBadge(selectedTransaction.status)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Metode Pembayaran</p>
                    <p className="font-semibold">{getPaymentMethodLabel(selectedTransaction.payment_method)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tanggal</p>
                    <p className="font-semibold">
                      {selectedTransaction.created_at.toLocaleDateString('id-ID')} {selectedTransaction.created_at.toLocaleTimeString('id-ID')}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="font-semibold mb-3">📦 Item yang dibeli:</h4>
                  <div className="space-y-2">
                    {selectedTransaction.items.map((item, index) => (
                      <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-gray-600">
                            {item.quantity} × Rp {item.unit_price.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            Rp {item.total_price.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-semibold">Rp {selectedTransaction.total_amount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dibayar:</span>
                    <span>Rp {selectedTransaction.payment_amount.toLocaleString('id-ID')}</span>
                  </div>
                  {selectedTransaction.change_amount > 0 && (
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Kembalian:</span>
                      <span>Rp {selectedTransaction.change_amount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {selectedTransaction.notes && (
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">📝 Catatan:</p>
                    <p>{selectedTransaction.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesReportPage;