import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, transactionsTable, transactionItemsTable, stockMovementsTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { createTransaction } from '../handlers/create_transaction';
import { eq } from 'drizzle-orm';

// Test product data
const testProduct1 = {
  name: 'Test Product 1',
  description: 'A product for testing',
  barcode: '1234567890',
  price: '19.99',
  stock_quantity: 100,
  category: 'Test Category',
  is_active: true
};

const testProduct2 = {
  name: 'Test Product 2',
  description: 'Another product for testing',
  barcode: '0987654321',
  price: '29.99',
  stock_quantity: 50,
  category: 'Test Category',
  is_active: true
};

// Test transaction input
const testInput: CreateTransactionInput = {
  items: [
    { product_id: 1, quantity: 2 },
    { product_id: 2, quantity: 1 }
  ],
  payment_method: 'cash',
  payment_amount: 100.00,
  notes: 'Test transaction'
};

describe('createTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a transaction with items', async () => {
    // Create test products first
    const products = await db.insert(productsTable)
      .values([testProduct1, testProduct2])
      .returning()
      .execute();

    // Update test input with actual product IDs
    const transactionInput = {
      ...testInput,
      items: [
        { product_id: products[0].id, quantity: 2 },
        { product_id: products[1].id, quantity: 1 }
      ]
    };

    const result = await createTransaction(transactionInput);

    // Verify transaction fields
    expect(result.id).toBeDefined();
    expect(result.transaction_number).toMatch(/^TRX-\d+-[a-z0-9]+$/);
    expect(result.total_amount).toEqual(69.97); // (19.99 * 2) + (29.99 * 1)
    expect(result.payment_method).toEqual('cash');
    expect(result.payment_amount).toEqual(100.00);
    expect(result.change_amount).toEqual(30.03); // 100.00 - 69.97
    expect(result.status).toEqual('completed');
    expect(result.notes).toEqual('Test transaction');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify transaction items
    expect(result.items).toHaveLength(2);
    
    const item1 = result.items.find(item => item.product_id === products[0].id);
    expect(item1).toBeDefined();
    expect(item1!.product_name).toEqual('Test Product 1');
    expect(item1!.quantity).toEqual(2);
    expect(item1!.unit_price).toEqual(19.99);
    expect(item1!.total_price).toEqual(39.98);

    const item2 = result.items.find(item => item.product_id === products[1].id);
    expect(item2).toBeDefined();
    expect(item2!.product_name).toEqual('Test Product 2');
    expect(item2!.quantity).toEqual(1);
    expect(item2!.unit_price).toEqual(29.99);
    expect(item2!.total_price).toEqual(29.99);
  });

  it('should save transaction to database', async () => {
    // Create test products first
    const products = await db.insert(productsTable)
      .values([testProduct1, testProduct2])
      .returning()
      .execute();

    const transactionInput = {
      ...testInput,
      items: [
        { product_id: products[0].id, quantity: 2 },
        { product_id: products[1].id, quantity: 1 }
      ]
    };

    const result = await createTransaction(transactionInput);

    // Verify transaction in database
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].transaction_number).toEqual(result.transaction_number);
    expect(parseFloat(transactions[0].total_amount)).toEqual(69.97);
    expect(parseFloat(transactions[0].payment_amount)).toEqual(100.00);
    expect(parseFloat(transactions[0].change_amount)).toEqual(30.03);

    // Verify transaction items in database
    const transactionItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, result.id))
      .execute();

    expect(transactionItems).toHaveLength(2);
  });

  it('should update product stock quantities', async () => {
    // Create test products first
    const products = await db.insert(productsTable)
      .values([testProduct1, testProduct2])
      .returning()
      .execute();

    const transactionInput = {
      ...testInput,
      items: [
        { product_id: products[0].id, quantity: 2 },
        { product_id: products[1].id, quantity: 1 }
      ]
    };

    await createTransaction(transactionInput);

    // Verify stock was reduced
    const updatedProducts = await db.select()
      .from(productsTable)
      .execute();

    const product1 = updatedProducts.find(p => p.id === products[0].id);
    const product2 = updatedProducts.find(p => p.id === products[1].id);

    expect(product1!.stock_quantity).toEqual(98); // 100 - 2
    expect(product2!.stock_quantity).toEqual(49); // 50 - 1
  });

  it('should create stock movement records', async () => {
    // Create test products first
    const products = await db.insert(productsTable)
      .values([testProduct1, testProduct2])
      .returning()
      .execute();

    const transactionInput = {
      ...testInput,
      items: [
        { product_id: products[0].id, quantity: 2 },
        { product_id: products[1].id, quantity: 1 }
      ]
    };

    const result = await createTransaction(transactionInput);

    // Verify stock movements were created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.reference_id, result.id))
      .execute();

    expect(stockMovements).toHaveLength(2);
    
    const movement1 = stockMovements.find(m => m.product_id === products[0].id);
    const movement2 = stockMovements.find(m => m.product_id === products[1].id);

    expect(movement1!.movement_type).toEqual('out');
    expect(movement1!.quantity).toEqual(-2);
    expect(movement1!.reference_type).toEqual('transaction');
    expect(movement1!.notes).toContain(result.transaction_number);

    expect(movement2!.movement_type).toEqual('out');
    expect(movement2!.quantity).toEqual(-1);
    expect(movement2!.reference_type).toEqual('transaction');
  });

  it('should throw error for non-existent product', async () => {
    const transactionInput = {
      ...testInput,
      items: [{ product_id: 999, quantity: 1 }]
    };

    await expect(createTransaction(transactionInput)).rejects.toThrow(/not found/i);
  });

  it('should throw error for insufficient stock', async () => {
    // Create product with low stock
    const products = await db.insert(productsTable)
      .values([{ ...testProduct1, stock_quantity: 1 }])
      .returning()
      .execute();

    const transactionInput = {
      ...testInput,
      items: [{ product_id: products[0].id, quantity: 5 }] // Request more than available
    };

    await expect(createTransaction(transactionInput)).rejects.toThrow(/insufficient stock/i);
  });

  it('should throw error for inactive product', async () => {
    // Create inactive product
    const products = await db.insert(productsTable)
      .values([{ ...testProduct1, is_active: false }])
      .returning()
      .execute();

    const transactionInput = {
      ...testInput,
      items: [{ product_id: products[0].id, quantity: 1 }]
    };

    await expect(createTransaction(transactionInput)).rejects.toThrow(/not active/i);
  });

  it('should calculate correct change amount', async () => {
    // Create test product
    const products = await db.insert(productsTable)
      .values([testProduct1])
      .returning()
      .execute();

    const transactionInput = {
      items: [{ product_id: products[0].id, quantity: 1 }],
      payment_method: 'cash' as const,
      payment_amount: 25.00, // Pay more than product price
      notes: null
    };

    const result = await createTransaction(transactionInput);

    expect(result.total_amount).toEqual(19.99);
    expect(result.payment_amount).toEqual(25.00);
    expect(result.change_amount).toEqual(5.01); // 25.00 - 19.99
  });

  it('should handle exact payment amount', async () => {
    // Create test product
    const products = await db.insert(productsTable)
      .values([testProduct1])
      .returning()
      .execute();

    const transactionInput = {
      items: [{ product_id: products[0].id, quantity: 1 }],
      payment_method: 'transfer' as const,
      payment_amount: 19.99, // Exact amount
      notes: null
    };

    const result = await createTransaction(transactionInput);

    expect(result.total_amount).toEqual(19.99);
    expect(result.payment_amount).toEqual(19.99);
    expect(result.change_amount).toEqual(0);
  });
});