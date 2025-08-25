import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, stockMovementsTable } from '../db/schema';
import { type StockAdjustmentInput } from '../schema';
import { adjustStock } from '../handlers/adjust_stock';
import { eq } from 'drizzle-orm';

// Helper function to create a test product
const createTestProduct = async () => {
  const result = await db.insert(productsTable)
    .values({
      name: 'Test Product',
      description: 'A product for testing stock adjustment',
      barcode: '123456789',
      price: '19.99',
      stock_quantity: 50,
      category: 'Test Category',
      is_active: true
    })
    .returning()
    .execute();
  
  return result[0];
};

describe('adjustStock', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should increase stock quantity with positive adjustment', async () => {
    const product = await createTestProduct();
    
    const input: StockAdjustmentInput = {
      product_id: product.id,
      adjustment_quantity: 25,
      notes: 'Restock inventory'
    };

    const result = await adjustStock(input);

    // Check returned product has updated stock
    expect(result.id).toEqual(product.id);
    expect(result.name).toEqual('Test Product');
    expect(result.stock_quantity).toEqual(75); // 50 + 25
    expect(result.price).toEqual(19.99);
    expect(typeof result.price).toBe('number');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should decrease stock quantity with negative adjustment', async () => {
    const product = await createTestProduct();
    
    const input: StockAdjustmentInput = {
      product_id: product.id,
      adjustment_quantity: -15,
      notes: 'Damaged inventory removal'
    };

    const result = await adjustStock(input);

    // Check returned product has updated stock
    expect(result.stock_quantity).toEqual(35); // 50 - 15
  });

  it('should save updated product to database', async () => {
    const product = await createTestProduct();
    
    const input: StockAdjustmentInput = {
      product_id: product.id,
      adjustment_quantity: 10,
      notes: null
    };

    await adjustStock(input);

    // Query database to verify update
    const updatedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product.id))
      .execute();

    expect(updatedProducts).toHaveLength(1);
    expect(updatedProducts[0].stock_quantity).toEqual(60); // 50 + 10
    expect(updatedProducts[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create stock movement record for audit trail', async () => {
    const product = await createTestProduct();
    
    const input: StockAdjustmentInput = {
      product_id: product.id,
      adjustment_quantity: -5,
      notes: 'Inventory correction'
    };

    await adjustStock(input);

    // Check stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.product_id, product.id))
      .execute();

    expect(stockMovements).toHaveLength(1);
    expect(stockMovements[0].product_id).toEqual(product.id);
    expect(stockMovements[0].movement_type).toEqual('adjustment');
    expect(stockMovements[0].quantity).toEqual(-5);
    expect(stockMovements[0].reference_type).toEqual('adjustment');
    expect(stockMovements[0].reference_id).toBeNull();
    expect(stockMovements[0].notes).toEqual('Inventory correction');
    expect(stockMovements[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle zero adjustment quantity', async () => {
    const product = await createTestProduct();
    
    const input: StockAdjustmentInput = {
      product_id: product.id,
      adjustment_quantity: 0,
      notes: 'No change needed'
    };

    const result = await adjustStock(input);

    // Stock should remain the same
    expect(result.stock_quantity).toEqual(50);

    // Stock movement should still be recorded
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.product_id, product.id))
      .execute();

    expect(stockMovements).toHaveLength(1);
    expect(stockMovements[0].quantity).toEqual(0);
  });

  it('should reject adjustment that would result in negative stock', async () => {
    const product = await createTestProduct();
    
    const input: StockAdjustmentInput = {
      product_id: product.id,
      adjustment_quantity: -75, // Would result in -25 stock
      notes: 'Large reduction'
    };

    await expect(adjustStock(input)).rejects.toThrow(/negative stock quantity/i);

    // Verify product stock wasn't changed
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product.id))
      .execute();

    expect(products[0].stock_quantity).toEqual(50); // Original quantity

    // Verify no stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.product_id, product.id))
      .execute();

    expect(stockMovements).toHaveLength(0);
  });

  it('should reject adjustment for non-existent product', async () => {
    const input: StockAdjustmentInput = {
      product_id: 999999, // Non-existent product ID
      adjustment_quantity: 10,
      notes: 'Test adjustment'
    };

    await expect(adjustStock(input)).rejects.toThrow(/product not found/i);

    // Verify no stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .execute();

    expect(stockMovements).toHaveLength(0);
  });

  it('should handle large stock adjustments correctly', async () => {
    const product = await createTestProduct();
    
    const input: StockAdjustmentInput = {
      product_id: product.id,
      adjustment_quantity: 1000,
      notes: 'Large restock'
    };

    const result = await adjustStock(input);

    expect(result.stock_quantity).toEqual(1050); // 50 + 1000

    // Verify in database
    const updatedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product.id))
      .execute();

    expect(updatedProducts[0].stock_quantity).toEqual(1050);
  });

  it('should preserve all other product fields during adjustment', async () => {
    const product = await createTestProduct();
    
    const input: StockAdjustmentInput = {
      product_id: product.id,
      adjustment_quantity: 5,
      notes: 'Small adjustment'
    };

    const result = await adjustStock(input);

    // All fields except stock_quantity and updated_at should remain unchanged
    expect(result.name).toEqual(product.name);
    expect(result.description).toEqual(product.description);
    expect(result.barcode).toEqual(product.barcode);
    expect(result.price).toEqual(parseFloat(product.price));
    expect(result.category).toEqual(product.category);
    expect(result.is_active).toEqual(product.is_active);
    expect(result.created_at).toEqual(product.created_at);
  });
});