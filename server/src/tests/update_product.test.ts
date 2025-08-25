import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type UpdateProductInput } from '../schema';
import { updateProduct } from '../handlers/update_product';
import { eq } from 'drizzle-orm';

describe('updateProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test product
  const createTestProduct = async () => {
    const result = await db.insert(productsTable)
      .values({
        name: 'Original Product',
        description: 'Original description',
        barcode: 'ORIG123',
        price: '10.99',
        stock_quantity: 50,
        category: 'test',
        is_active: true
      })
      .returning()
      .execute();
    
    return result[0];
  };

  it('should update a product successfully', async () => {
    const testProduct = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: testProduct.id,
      name: 'Updated Product',
      description: 'Updated description',
      price: 15.99,
      stock_quantity: 75
    };

    const result = await updateProduct(updateInput);

    // Verify the returned product has updated fields
    expect(result.id).toEqual(testProduct.id);
    expect(result.name).toEqual('Updated Product');
    expect(result.description).toEqual('Updated description');
    expect(result.price).toEqual(15.99);
    expect(result.stock_quantity).toEqual(75);
    expect(result.category).toEqual('test'); // Unchanged
    expect(result.barcode).toEqual('ORIG123'); // Unchanged
    expect(result.is_active).toBe(true); // Unchanged
    expect(typeof result.price).toBe('number');
  });

  it('should update product in database', async () => {
    const testProduct = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: testProduct.id,
      name: 'Database Updated Product',
      price: 25.50
    };

    await updateProduct(updateInput);

    // Verify the product was updated in the database
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, testProduct.id))
      .execute();

    expect(products).toHaveLength(1);
    expect(products[0].name).toEqual('Database Updated Product');
    expect(parseFloat(products[0].price)).toEqual(25.50);
    expect(products[0].description).toEqual('Original description'); // Unchanged
  });

  it('should update barcode when provided', async () => {
    const testProduct = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: testProduct.id,
      barcode: 'NEW123'
    };

    const result = await updateProduct(updateInput);

    expect(result.barcode).toEqual('NEW123');
    
    // Verify in database
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, testProduct.id))
      .execute();

    expect(products[0].barcode).toEqual('NEW123');
  });

  it('should set barcode to null when explicitly provided', async () => {
    const testProduct = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: testProduct.id,
      barcode: null
    };

    const result = await updateProduct(updateInput);

    expect(result.barcode).toBeNull();
    
    // Verify in database
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, testProduct.id))
      .execute();

    expect(products[0].barcode).toBeNull();
  });

  it('should update is_active status', async () => {
    const testProduct = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: testProduct.id,
      is_active: false
    };

    const result = await updateProduct(updateInput);

    expect(result.is_active).toBe(false);
    
    // Verify in database
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, testProduct.id))
      .execute();

    expect(products[0].is_active).toBe(false);
  });

  it('should update updated_at timestamp', async () => {
    const testProduct = await createTestProduct();
    const originalUpdatedAt = testProduct.updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const updateInput: UpdateProductInput = {
      id: testProduct.id,
      name: 'Updated Name'
    };

    const result = await updateProduct(updateInput);

    expect(result.updated_at).not.toEqual(originalUpdatedAt);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > originalUpdatedAt).toBe(true);
  });

  it('should throw error when product does not exist', async () => {
    const updateInput: UpdateProductInput = {
      id: 999999,
      name: 'Non-existent Product'
    };

    await expect(updateProduct(updateInput)).rejects.toThrow(/Product with id 999999 not found/i);
  });

  it('should throw error when barcode already exists for another product', async () => {
    // Create first product with a barcode
    const product1 = await createTestProduct();
    
    // Create second product with different barcode
    const product2 = await db.insert(productsTable)
      .values({
        name: 'Second Product',
        description: 'Second description',
        barcode: 'SECOND123',
        price: '20.99',
        stock_quantity: 30,
        category: 'test',
        is_active: true
      })
      .returning()
      .execute();

    // Try to update second product with first product's barcode
    const updateInput: UpdateProductInput = {
      id: product2[0].id,
      barcode: product1.barcode // This should conflict
    };

    await expect(updateProduct(updateInput)).rejects.toThrow(/Product with barcode 'ORIG123' already exists/i);
  });

  it('should allow updating product with same barcode (no change)', async () => {
    const testProduct = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: testProduct.id,
      barcode: testProduct.barcode, // Same barcode
      name: 'Updated Name'
    };

    const result = await updateProduct(updateInput);

    expect(result.barcode).toEqual(testProduct.barcode);
    expect(result.name).toEqual('Updated Name');
  });

  it('should handle partial updates correctly', async () => {
    const testProduct = await createTestProduct();
    
    // Update only price
    const updateInput: UpdateProductInput = {
      id: testProduct.id,
      price: 99.99
    };

    const result = await updateProduct(updateInput);

    // Only price should change
    expect(result.price).toEqual(99.99);
    expect(result.name).toEqual('Original Product'); // Unchanged
    expect(result.description).toEqual('Original description'); // Unchanged
    expect(result.barcode).toEqual('ORIG123'); // Unchanged
    expect(result.stock_quantity).toEqual(50); // Unchanged
  });

  it('should handle zero values correctly', async () => {
    const testProduct = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: testProduct.id,
      stock_quantity: 0
    };

    const result = await updateProduct(updateInput);

    expect(result.stock_quantity).toEqual(0);
    expect(typeof result.stock_quantity).toBe('number');
  });

  it('should preserve created_at timestamp', async () => {
    const testProduct = await createTestProduct();
    const originalCreatedAt = testProduct.created_at;
    
    const updateInput: UpdateProductInput = {
      id: testProduct.id,
      name: 'Updated Name'
    };

    const result = await updateProduct(updateInput);

    expect(result.created_at).toEqual(originalCreatedAt);
  });
});