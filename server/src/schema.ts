import { z } from 'zod';

// Product schema with proper numeric handling
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  barcode: z.string().nullable(),
  price: z.number(),
  stock_quantity: z.number().int(),
  category: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

// Input schema for creating products
export const createProductInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  barcode: z.string().nullable(),
  price: z.number().positive(),
  stock_quantity: z.number().int().nonnegative(),
  category: z.string().nullable(),
  is_active: z.boolean().default(true)
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

// Input schema for updating products
export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  category: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// Payment method enum
export const paymentMethodEnum = z.enum(['cash', 'transfer', 'e_wallet']);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

// Transaction status enum
export const transactionStatusEnum = z.enum(['pending', 'completed', 'cancelled']);
export type TransactionStatus = z.infer<typeof transactionStatusEnum>;

// Transaction schema
export const transactionSchema = z.object({
  id: z.number(),
  transaction_number: z.string(),
  total_amount: z.number(),
  payment_method: paymentMethodEnum,
  payment_amount: z.number(),
  change_amount: z.number(),
  status: transactionStatusEnum,
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Transaction item schema
export const transactionItemSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  product_id: z.number(),
  product_name: z.string(),
  quantity: z.number().int(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type TransactionItem = z.infer<typeof transactionItemSchema>;

// Input schema for creating transactions
export const createTransactionInputSchema = z.object({
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().int().positive()
  })).min(1),
  payment_method: paymentMethodEnum,
  payment_amount: z.number().positive(),
  notes: z.string().nullable()
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

// Stock movement schema
export const stockMovementSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  movement_type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().int(),
  reference_type: z.enum(['transaction', 'adjustment', 'restock']),
  reference_id: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date()
});

export type StockMovement = z.infer<typeof stockMovementSchema>;

// Input schema for stock adjustment
export const stockAdjustmentInputSchema = z.object({
  product_id: z.number(),
  adjustment_quantity: z.number().int(),
  notes: z.string().nullable()
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentInputSchema>;

// Dashboard stats schema
export const dashboardStatsSchema = z.object({
  total_sales_today: z.number(),
  total_transactions_today: z.number().int(),
  low_stock_products: z.number().int(),
  total_revenue_month: z.number(),
  top_selling_products: z.array(z.object({
    product_id: z.number(),
    product_name: z.string(),
    total_sold: z.number().int(),
    revenue: z.number()
  }))
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

// Sales report schema
export const salesReportSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  total_sales: z.number(),
  total_transactions: z.number().int(),
  average_transaction: z.number(),
  transactions: z.array(transactionSchema)
});

export type SalesReport = z.infer<typeof salesReportSchema>;

// Input schema for sales reports
export const salesReportInputSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional()
});

export type SalesReportInput = z.infer<typeof salesReportInputSchema>;

// Barcode search input schema
export const barcodeSearchInputSchema = z.object({
  barcode: z.string().min(1)
});

export type BarcodeSearchInput = z.infer<typeof barcodeSearchInputSchema>;

// Transaction with items schema (for detailed view)
export const transactionWithItemsSchema = transactionSchema.extend({
  items: z.array(transactionItemSchema)
});

export type TransactionWithItems = z.infer<typeof transactionWithItemsSchema>;