import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum definitions
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'transfer', 'e_wallet']);
export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'completed', 'cancelled']);
export const movementTypeEnum = pgEnum('movement_type', ['in', 'out', 'adjustment']);
export const referenceTypeEnum = pgEnum('reference_type', ['transaction', 'adjustment', 'restock']);

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  barcode: text('barcode'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  stock_quantity: integer('stock_quantity').notNull().default(0),
  category: text('category'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  transaction_number: text('transaction_number').notNull().unique(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  payment_method: paymentMethodEnum('payment_method').notNull(),
  payment_amount: numeric('payment_amount', { precision: 10, scale: 2 }).notNull(),
  change_amount: numeric('change_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  status: transactionStatusEnum('status').notNull().default('completed'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Transaction items table
export const transactionItemsTable = pgTable('transaction_items', {
  id: serial('id').primaryKey(),
  transaction_id: integer('transaction_id').notNull().references(() => transactionsTable.id, { onDelete: 'cascade' }),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  product_name: text('product_name').notNull(), // Store product name at time of transaction
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Stock movements table
export const stockMovementsTable = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  movement_type: movementTypeEnum('movement_type').notNull(),
  quantity: integer('quantity').notNull(), // Positive for in, negative for out
  reference_type: referenceTypeEnum('reference_type').notNull(),
  reference_id: integer('reference_id'), // ID of the transaction or adjustment
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Define relations
export const productsRelations = relations(productsTable, ({ many }) => ({
  transactionItems: many(transactionItemsTable),
  stockMovements: many(stockMovementsTable)
}));

export const transactionsRelations = relations(transactionsTable, ({ many }) => ({
  items: many(transactionItemsTable)
}));

export const transactionItemsRelations = relations(transactionItemsTable, ({ one }) => ({
  transaction: one(transactionsTable, {
    fields: [transactionItemsTable.transaction_id],
    references: [transactionsTable.id]
  }),
  product: one(productsTable, {
    fields: [transactionItemsTable.product_id],
    references: [productsTable.id]
  })
}));

export const stockMovementsRelations = relations(stockMovementsTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [stockMovementsTable.product_id],
    references: [productsTable.id]
  })
}));

// TypeScript types for the table schemas
export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;
export type TransactionItem = typeof transactionItemsTable.$inferSelect;
export type NewTransactionItem = typeof transactionItemsTable.$inferInsert;
export type StockMovement = typeof stockMovementsTable.$inferSelect;
export type NewStockMovement = typeof stockMovementsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  products: productsTable,
  transactions: transactionsTable,
  transactionItems: transactionItemsTable,
  stockMovements: stockMovementsTable
};