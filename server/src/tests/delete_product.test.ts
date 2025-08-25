import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { deleteProduct } from '../handlers/delete_product';

describe('deleteProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should soft delete an existing product', async () => {
    // Create a test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A product for testing deletion',
        barcode: '1234567890',
        price: '29.99',
        stock_quantity: 50,
        category: 'Electronics',
        is_active: true
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Delete the product
    const result = await deleteProduct(productId);

    // Should return true
    expect(result).toBe(true);

    // Verify product is soft deleted (is_active = false)
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(products).toHaveLength(1);
    expect(products[0].is_active).toBe(false);
    expect(products[0].name).toBe('Test Product');
  });

  it('should throw error when product does not exist', async () => {
    const nonExistentId = 99999;

    await expect(deleteProduct(nonExistentId)).rejects.toThrow(/Product with id 99999 not found/i);
  });

  it('should throw error when product is referenced in pending transactions', async () => {
    // Create a test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A product for testing deletion',
        barcode: '1234567890',
        price: '29.99',
        stock_quantity: 50,
        category: 'Electronics',
        is_active: true
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Create a pending transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-001',
        total_amount: '29.99',
        payment_method: 'cash',
        payment_amount: '30.00',
        change_amount: '0.01',
        status: 'pending'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create transaction item referencing the product
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        product_id: productId,
        product_name: 'Test Product',
        quantity: 1,
        unit_price: '29.99',
        total_price: '29.99'
      })
      .execute();

    // Attempt to delete product should fail
    await expect(deleteProduct(productId)).rejects.toThrow(/Cannot delete product.*pending transactions/i);

    // Verify product is still active
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(products).toHaveLength(1);
    expect(products[0].is_active).toBe(true);
  });

  it('should allow deletion when product is referenced in completed transactions', async () => {
    // Create a test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A product for testing deletion',
        barcode: '1234567890',
        price: '29.99',
        stock_quantity: 50,
        category: 'Electronics',
        is_active: true
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Create a completed transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-002',
        total_amount: '29.99',
        payment_method: 'cash',
        payment_amount: '30.00',
        change_amount: '0.01',
        status: 'completed'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create transaction item referencing the product
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        product_id: productId,
        product_name: 'Test Product',
        quantity: 1,
        unit_price: '29.99',
        total_price: '29.99'
      })
      .execute();

    // Delete should succeed for completed transactions
    const result = await deleteProduct(productId);

    expect(result).toBe(true);

    // Verify product is soft deleted
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(products).toHaveLength(1);
    expect(products[0].is_active).toBe(false);
  });

  it('should allow deletion when product is referenced in cancelled transactions', async () => {
    // Create a test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A product for testing deletion',
        barcode: '1234567890',
        price: '29.99',
        stock_quantity: 50,
        category: 'Electronics',
        is_active: true
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Create a cancelled transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-003',
        total_amount: '29.99',
        payment_method: 'cash',
        payment_amount: '30.00',
        change_amount: '0.01',
        status: 'cancelled'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create transaction item referencing the product
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        product_id: productId,
        product_name: 'Test Product',
        quantity: 1,
        unit_price: '29.99',
        total_price: '29.99'
      })
      .execute();

    // Delete should succeed for cancelled transactions
    const result = await deleteProduct(productId);

    expect(result).toBe(true);

    // Verify product is soft deleted
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(products).toHaveLength(1);
    expect(products[0].is_active).toBe(false);
  });

  it('should update the updated_at timestamp when soft deleting', async () => {
    // Create a test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A product for testing deletion',
        barcode: '1234567890',
        price: '29.99',
        stock_quantity: 50,
        category: 'Electronics',
        is_active: true
      })
      .returning()
      .execute();

    const productId = productResult[0].id;
    const originalUpdatedAt = productResult[0].updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Delete the product
    await deleteProduct(productId);

    // Verify updated_at timestamp was changed
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(products).toHaveLength(1);
    expect(products[0].updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});