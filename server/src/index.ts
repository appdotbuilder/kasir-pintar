import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createProductInputSchema,
  updateProductInputSchema,
  createTransactionInputSchema,
  stockAdjustmentInputSchema,
  salesReportInputSchema,
  barcodeSearchInputSchema
} from './schema';

// Import handlers
import { createProduct } from './handlers/create_product';
import { getProducts } from './handlers/get_products';
import { updateProduct } from './handlers/update_product';
import { deleteProduct } from './handlers/delete_product';
import { searchProductByBarcode } from './handlers/search_product_by_barcode';
import { createTransaction } from './handlers/create_transaction';
import { getTransactions } from './handlers/get_transactions';
import { getTransactionDetails } from './handlers/get_transaction_details';
import { getDashboardStats } from './handlers/get_dashboard_stats';
import { adjustStock } from './handlers/adjust_stock';
import { getStockMovements } from './handlers/get_stock_movements';
import { getSalesReport } from './handlers/get_sales_report';
import { getLowStockProducts } from './handlers/get_low_stock_products';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Dashboard endpoints
  getDashboardStats: publicProcedure
    .query(() => getDashboardStats()),

  // Product management endpoints (Halaman Data Produk/Barang)
  getProducts: publicProcedure
    .query(() => getProducts()),
  
  createProduct: publicProcedure
    .input(createProductInputSchema)
    .mutation(({ input }) => createProduct(input)),
  
  updateProduct: publicProcedure
    .input(updateProductInputSchema)
    .mutation(({ input }) => updateProduct(input)),
  
  deleteProduct: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteProduct(input.id)),
  
  searchProductByBarcode: publicProcedure
    .input(barcodeSearchInputSchema)
    .query(({ input }) => searchProductByBarcode(input)),

  // Transaction/Sales endpoints (Halaman Transaksi/Penjualan)
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),
  
  getTransactions: publicProcedure
    .query(() => getTransactions()),
  
  getTransactionDetails: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getTransactionDetails(input.id)),

  // Stock management endpoints (Halaman Manajemen Stok)
  adjustStock: publicProcedure
    .input(stockAdjustmentInputSchema)
    .mutation(({ input }) => adjustStock(input)),
  
  getStockMovements: publicProcedure
    .input(z.object({ productId: z.number().optional() }))
    .query(({ input }) => getStockMovements(input.productId)),
  
  getLowStockProducts: publicProcedure
    .input(z.object({ threshold: z.number().default(10) }))
    .query(({ input }) => getLowStockProducts(input.threshold)),

  // Sales report endpoints (Halaman Laporan Penjualan)
  getSalesReport: publicProcedure
    .input(salesReportInputSchema)
    .query(({ input }) => getSalesReport(input))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC Cash Register API server listening at port: ${port}`);
}

start();