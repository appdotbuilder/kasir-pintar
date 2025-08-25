import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { getTransactionDetails } from '../handlers/get_transaction_details';

describe('getTransactionDetails', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent transaction', async () => {
    const result = await getTransactionDetails(999);
    expect(result).toBeNull();
  });

  it('should return transaction with items', async () => {
    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'Test description',
        barcode: '1234567890',
        price: '19.99',
        stock_quantity: 100,
        category: 'test',
        is_active: true
      })
      .returning()
      .execute();

    const product = productResult[0];

    // Create test transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-001',
        total_amount: '39.98',
        payment_method: 'cash',
        payment_amount: '40.00',
        change_amount: '0.02',
        status: 'completed',
        notes: 'Test transaction'
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Create transaction items
    await db.insert(transactionItemsTable)
      .values([
        {
          transaction_id: transaction.id,
          product_id: product.id,
          product_name: 'Test Product',
          quantity: 2,
          unit_price: '19.99',
          total_price: '39.98'
        }
      ])
      .execute();

    // Test the handler
    const result = await getTransactionDetails(transaction.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(transaction.id);
    expect(result!.transaction_number).toEqual('TXN-001');
    expect(result!.total_amount).toEqual(39.98);
    expect(typeof result!.total_amount).toBe('number');
    expect(result!.payment_method).toEqual('cash');
    expect(result!.payment_amount).toEqual(40.00);
    expect(typeof result!.payment_amount).toBe('number');
    expect(result!.change_amount).toEqual(0.02);
    expect(typeof result!.change_amount).toBe('number');
    expect(result!.status).toEqual('completed');
    expect(result!.notes).toEqual('Test transaction');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);

    // Verify items
    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];
    expect(item.transaction_id).toEqual(transaction.id);
    expect(item.product_id).toEqual(product.id);
    expect(item.product_name).toEqual('Test Product');
    expect(item.quantity).toEqual(2);
    expect(item.unit_price).toEqual(19.99);
    expect(typeof item.unit_price).toBe('number');
    expect(item.total_price).toEqual(39.98);
    expect(typeof item.total_price).toBe('number');
    expect(item.created_at).toBeInstanceOf(Date);
  });

  it('should return transaction with multiple items', async () => {
    // Create test products
    const productResult1 = await db.insert(productsTable)
      .values({
        name: 'Product 1',
        description: 'Product 1 description',
        barcode: '1111111111',
        price: '15.50',
        stock_quantity: 50,
        category: 'category1',
        is_active: true
      })
      .returning()
      .execute();

    const productResult2 = await db.insert(productsTable)
      .values({
        name: 'Product 2',
        description: 'Product 2 description',
        barcode: '2222222222',
        price: '25.75',
        stock_quantity: 30,
        category: 'category2',
        is_active: true
      })
      .returning()
      .execute();

    const product1 = productResult1[0];
    const product2 = productResult2[0];

    // Create test transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-002',
        total_amount: '67.00',
        payment_method: 'transfer',
        payment_amount: '67.00',
        change_amount: '0.00',
        status: 'completed',
        notes: null
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Create multiple transaction items
    await db.insert(transactionItemsTable)
      .values([
        {
          transaction_id: transaction.id,
          product_id: product1.id,
          product_name: 'Product 1',
          quantity: 2,
          unit_price: '15.50',
          total_price: '31.00'
        },
        {
          transaction_id: transaction.id,
          product_id: product2.id,
          product_name: 'Product 2',
          quantity: 1,
          unit_price: '25.75',
          total_price: '25.75'
        },
        {
          transaction_id: transaction.id,
          product_id: product1.id,
          product_name: 'Product 1',
          quantity: 1,
          unit_price: '10.25',
          total_price: '10.25'
        }
      ])
      .execute();

    // Test the handler
    const result = await getTransactionDetails(transaction.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(transaction.id);
    expect(result!.transaction_number).toEqual('TXN-002');
    expect(result!.total_amount).toEqual(67.00);
    expect(result!.payment_method).toEqual('transfer');
    expect(result!.payment_amount).toEqual(67.00);
    expect(result!.change_amount).toEqual(0.00);
    expect(result!.status).toEqual('completed');
    expect(result!.notes).toBeNull();

    // Verify all items are included
    expect(result!.items).toHaveLength(3);

    // Verify first item
    const item1 = result!.items.find(item => item.product_id === product1.id && item.quantity === 2);
    expect(item1).toBeDefined();
    expect(item1!.product_name).toEqual('Product 1');
    expect(item1!.unit_price).toEqual(15.50);
    expect(item1!.total_price).toEqual(31.00);

    // Verify second item
    const item2 = result!.items.find(item => item.product_id === product2.id);
    expect(item2).toBeDefined();
    expect(item2!.product_name).toEqual('Product 2');
    expect(item2!.quantity).toEqual(1);
    expect(item2!.unit_price).toEqual(25.75);
    expect(item2!.total_price).toEqual(25.75);

    // Verify third item
    const item3 = result!.items.find(item => item.product_id === product1.id && item.quantity === 1);
    expect(item3).toBeDefined();
    expect(item3!.product_name).toEqual('Product 1');
    expect(item3!.unit_price).toEqual(10.25);
    expect(item3!.total_price).toEqual(10.25);
  });

  it('should return transaction with empty items array', async () => {
    // Create test transaction without items
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-003',
        total_amount: '0.00',
        payment_method: 'e_wallet',
        payment_amount: '0.00',
        change_amount: '0.00',
        status: 'cancelled',
        notes: 'Cancelled transaction'
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Test the handler
    const result = await getTransactionDetails(transaction.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(transaction.id);
    expect(result!.transaction_number).toEqual('TXN-003');
    expect(result!.total_amount).toEqual(0.00);
    expect(result!.payment_method).toEqual('e_wallet');
    expect(result!.status).toEqual('cancelled');
    expect(result!.notes).toEqual('Cancelled transaction');
    expect(result!.items).toHaveLength(0);
  });

  it('should handle numeric precision correctly', async () => {
    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Precision Product',
        description: 'Test precision',
        barcode: '9999999999',
        price: '123.45',
        stock_quantity: 10,
        category: 'precision',
        is_active: true
      })
      .returning()
      .execute();

    const product = productResult[0];

    // Create transaction with precise decimal values
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-PRECISION',
        total_amount: '246.90',
        payment_method: 'cash',
        payment_amount: '250.00',
        change_amount: '3.10',
        status: 'completed',
        notes: 'Precision test'
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Create transaction item with precise values
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transaction.id,
        product_id: product.id,
        product_name: 'Precision Product',
        quantity: 2,
        unit_price: '123.45',
        total_price: '246.90'
      })
      .execute();

    // Test the handler
    const result = await getTransactionDetails(transaction.id);

    expect(result).toBeDefined();
    expect(result!.total_amount).toEqual(246.90);
    expect(result!.payment_amount).toEqual(250.00);
    expect(result!.change_amount).toEqual(3.10);

    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];
    expect(item.unit_price).toEqual(123.45);
    expect(item.total_price).toEqual(246.90);

    // Verify all numeric fields are actually numbers, not strings
    expect(typeof result!.total_amount).toBe('number');
    expect(typeof result!.payment_amount).toBe('number');
    expect(typeof result!.change_amount).toBe('number');
    expect(typeof item.unit_price).toBe('number');
    expect(typeof item.total_price).toBe('number');
  });
});