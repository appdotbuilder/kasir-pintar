import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, stockMovementsTable } from '../db/schema';
import { getStockMovements } from '../handlers/get_stock_movements';

describe('getStockMovements', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no stock movements exist', async () => {
    const result = await getStockMovements();
    expect(result).toEqual([]);
  });

  it('should return all stock movements when no productId filter is provided', async () => {
    // Create test products first
    const products = await db.insert(productsTable)
      .values([
        {
          name: 'Product A',
          description: 'Test product A',
          price: '10.00',
          stock_quantity: 100,
          category: 'electronics',
          is_active: true
        },
        {
          name: 'Product B',
          description: 'Test product B',
          price: '20.00',
          stock_quantity: 50,
          category: 'books',
          is_active: true
        }
      ])
      .returning()
      .execute();

    const productA = products[0];
    const productB = products[1];

    // Create stock movements for both products
    await db.insert(stockMovementsTable)
      .values([
        {
          product_id: productA.id,
          movement_type: 'in',
          quantity: 50,
          reference_type: 'restock',
          reference_id: null,
          notes: 'Initial stock'
        },
        {
          product_id: productB.id,
          movement_type: 'out',
          quantity: -10,
          reference_type: 'transaction',
          reference_id: 1,
          notes: 'Sale transaction'
        },
        {
          product_id: productA.id,
          movement_type: 'adjustment',
          quantity: 5,
          reference_type: 'adjustment',
          reference_id: null,
          notes: 'Stock count adjustment'
        }
      ])
      .execute();

    const result = await getStockMovements();

    expect(result).toHaveLength(3);
    
    // Verify all movements are returned
    expect(result.some(m => m.product_id === productA.id && m.movement_type === 'in')).toBe(true);
    expect(result.some(m => m.product_id === productB.id && m.movement_type === 'out')).toBe(true);
    expect(result.some(m => m.product_id === productA.id && m.movement_type === 'adjustment')).toBe(true);
  });

  it('should filter stock movements by product_id when provided', async () => {
    // Create test products
    const products = await db.insert(productsTable)
      .values([
        {
          name: 'Product A',
          description: 'Test product A',
          price: '15.00',
          stock_quantity: 75,
          category: 'toys',
          is_active: true
        },
        {
          name: 'Product B',
          description: 'Test product B',
          price: '25.00',
          stock_quantity: 30,
          category: 'games',
          is_active: true
        }
      ])
      .returning()
      .execute();

    const productA = products[0];
    const productB = products[1];

    // Create stock movements for both products
    await db.insert(stockMovementsTable)
      .values([
        {
          product_id: productA.id,
          movement_type: 'in',
          quantity: 25,
          reference_type: 'restock',
          reference_id: null,
          notes: 'Restock A'
        },
        {
          product_id: productB.id,
          movement_type: 'in',
          quantity: 15,
          reference_type: 'restock',
          reference_id: null,
          notes: 'Restock B'
        },
        {
          product_id: productA.id,
          movement_type: 'out',
          quantity: -5,
          reference_type: 'transaction',
          reference_id: 1,
          notes: 'Sale A'
        }
      ])
      .execute();

    // Filter by product A
    const resultA = await getStockMovements(productA.id);
    
    expect(resultA).toHaveLength(2);
    expect(resultA.every(m => m.product_id === productA.id)).toBe(true);
    expect(resultA.some(m => m.movement_type === 'in' && m.quantity === 25)).toBe(true);
    expect(resultA.some(m => m.movement_type === 'out' && m.quantity === -5)).toBe(true);

    // Filter by product B
    const resultB = await getStockMovements(productB.id);
    
    expect(resultB).toHaveLength(1);
    expect(resultB[0].product_id).toEqual(productB.id);
    expect(resultB[0].movement_type).toEqual('in');
    expect(resultB[0].quantity).toEqual(15);
  });

  it('should return movements sorted by created_at descending (most recent first)', async () => {
    // Create test product
    const product = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'For testing sort order',
        price: '12.50',
        stock_quantity: 100,
        category: 'test',
        is_active: true
      })
      .returning()
      .execute();

    const productId = product[0].id;

    // Create movements with small time delays to ensure different timestamps
    await db.insert(stockMovementsTable)
      .values({
        product_id: productId,
        movement_type: 'in',
        quantity: 100,
        reference_type: 'restock',
        reference_id: null,
        notes: 'First movement'
      })
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(stockMovementsTable)
      .values({
        product_id: productId,
        movement_type: 'out',
        quantity: -20,
        reference_type: 'transaction',
        reference_id: 1,
        notes: 'Second movement'
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(stockMovementsTable)
      .values({
        product_id: productId,
        movement_type: 'adjustment',
        quantity: 5,
        reference_type: 'adjustment',
        reference_id: null,
        notes: 'Third movement'
      })
      .execute();

    const result = await getStockMovements(productId);

    expect(result).toHaveLength(3);
    
    // Verify sorting - most recent first
    expect(result[0].notes).toEqual('Third movement');
    expect(result[1].notes).toEqual('Second movement');
    expect(result[2].notes).toEqual('First movement');

    // Verify timestamps are in descending order
    expect(result[0].created_at >= result[1].created_at).toBe(true);
    expect(result[1].created_at >= result[2].created_at).toBe(true);
  });

  it('should return empty array when filtering by non-existent product_id', async () => {
    // Create a product and movement
    const product = await db.insert(productsTable)
      .values({
        name: 'Existing Product',
        description: 'This product exists',
        price: '8.99',
        stock_quantity: 50,
        category: 'existing',
        is_active: true
      })
      .returning()
      .execute();

    await db.insert(stockMovementsTable)
      .values({
        product_id: product[0].id,
        movement_type: 'in',
        quantity: 50,
        reference_type: 'restock',
        reference_id: null,
        notes: 'Existing movement'
      })
      .execute();

    // Try to filter by non-existent product ID
    const result = await getStockMovements(99999);
    
    expect(result).toEqual([]);
  });

  it('should handle all movement types and reference types correctly', async () => {
    // Create test product
    const product = await db.insert(productsTable)
      .values({
        name: 'Movement Types Test',
        description: 'Testing all movement types',
        price: '30.00',
        stock_quantity: 200,
        category: 'test',
        is_active: true
      })
      .returning()
      .execute();

    const productId = product[0].id;

    // Create movements with all types
    await db.insert(stockMovementsTable)
      .values([
        {
          product_id: productId,
          movement_type: 'in',
          quantity: 100,
          reference_type: 'restock',
          reference_id: null,
          notes: 'Restock movement'
        },
        {
          product_id: productId,
          movement_type: 'out',
          quantity: -30,
          reference_type: 'transaction',
          reference_id: 123,
          notes: 'Transaction sale'
        },
        {
          product_id: productId,
          movement_type: 'adjustment',
          quantity: -5,
          reference_type: 'adjustment',
          reference_id: 456,
          notes: 'Inventory adjustment'
        }
      ])
      .execute();

    const result = await getStockMovements(productId);

    expect(result).toHaveLength(3);

    // Verify all movement types are present
    const movementTypes = result.map(m => m.movement_type).sort();
    expect(movementTypes).toEqual(['adjustment', 'in', 'out']);

    // Verify all reference types are present
    const referenceTypes = result.map(m => m.reference_type).sort();
    expect(referenceTypes).toEqual(['adjustment', 'restock', 'transaction']);

    // Verify specific fields for each movement type
    const inMovement = result.find(m => m.movement_type === 'in');
    expect(inMovement?.quantity).toEqual(100);
    expect(inMovement?.reference_type).toEqual('restock');
    expect(inMovement?.reference_id).toBeNull();

    const outMovement = result.find(m => m.movement_type === 'out');
    expect(outMovement?.quantity).toEqual(-30);
    expect(outMovement?.reference_type).toEqual('transaction');
    expect(outMovement?.reference_id).toEqual(123);

    const adjustmentMovement = result.find(m => m.movement_type === 'adjustment');
    expect(adjustmentMovement?.quantity).toEqual(-5);
    expect(adjustmentMovement?.reference_type).toEqual('adjustment');
    expect(adjustmentMovement?.reference_id).toEqual(456);
  });

  it('should include all required fields in the response', async () => {
    // Create test product
    const product = await db.insert(productsTable)
      .values({
        name: 'Field Test Product',
        description: 'For testing all fields',
        price: '45.00',
        stock_quantity: 150,
        category: 'field-test',
        is_active: true
      })
      .returning()
      .execute();

    // Create stock movement with all fields populated
    await db.insert(stockMovementsTable)
      .values({
        product_id: product[0].id,
        movement_type: 'out',
        quantity: -25,
        reference_type: 'transaction',
        reference_id: 789,
        notes: 'Complete field test'
      })
      .execute();

    const result = await getStockMovements(product[0].id);

    expect(result).toHaveLength(1);
    const movement = result[0];

    // Verify all required fields are present and have correct types
    expect(typeof movement.id).toBe('number');
    expect(typeof movement.product_id).toBe('number');
    expect(movement.movement_type).toEqual('out');
    expect(typeof movement.quantity).toBe('number');
    expect(movement.reference_type).toEqual('transaction');
    expect(typeof movement.reference_id).toBe('number');
    expect(typeof movement.notes).toBe('string');
    expect(movement.created_at).toBeInstanceOf(Date);

    // Verify specific values
    expect(movement.product_id).toEqual(product[0].id);
    expect(movement.quantity).toEqual(-25);
    expect(movement.reference_id).toEqual(789);
    expect(movement.notes).toEqual('Complete field test');
  });
});