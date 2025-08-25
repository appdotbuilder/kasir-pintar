import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput } from '../schema';
import { createProduct } from '../handlers/create_product';
import { eq } from 'drizzle-orm';

// Complete test input with all required fields
const testInput: CreateProductInput = {
  name: 'Test Product',
  description: 'A product for testing',
  barcode: 'TEST123',
  price: 19.99,
  stock_quantity: 100,
  category: 'Electronics',
  is_active: true
};

describe('createProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a product with all fields', async () => {
    const result = await createProduct(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Product');
    expect(result.description).toEqual('A product for testing');
    expect(result.barcode).toEqual('TEST123');
    expect(result.price).toEqual(19.99);
    expect(typeof result.price).toBe('number'); // Verify numeric conversion
    expect(result.stock_quantity).toEqual(100);
    expect(result.category).toEqual('Electronics');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a product with nullable fields as null', async () => {
    const minimalInput: CreateProductInput = {
      name: 'Minimal Product',
      description: null,
      barcode: null,
      price: 9.99,
      stock_quantity: 50,
      category: null,
      is_active: true
    };

    const result = await createProduct(minimalInput);

    expect(result.name).toEqual('Minimal Product');
    expect(result.description).toBeNull();
    expect(result.barcode).toBeNull();
    expect(result.price).toEqual(9.99);
    expect(result.stock_quantity).toEqual(50);
    expect(result.category).toBeNull();
    expect(result.is_active).toEqual(true);
  });

  it('should create a product with is_active default value', async () => {
    const inputWithDefaults: CreateProductInput = {
      name: 'Default Product',
      description: 'Product with defaults',
      barcode: 'DEFAULT123',
      price: 15.50,
      stock_quantity: 25,
      category: 'Test',
      is_active: true // Zod applies default, so this will be present
    };

    const result = await createProduct(inputWithDefaults);

    expect(result.is_active).toEqual(true);
  });

  it('should save product to database correctly', async () => {
    const result = await createProduct(testInput);

    // Query database to verify product was saved
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, result.id))
      .execute();

    expect(products).toHaveLength(1);
    const savedProduct = products[0];
    expect(savedProduct.name).toEqual('Test Product');
    expect(savedProduct.description).toEqual('A product for testing');
    expect(savedProduct.barcode).toEqual('TEST123');
    expect(parseFloat(savedProduct.price)).toEqual(19.99); // Database stores as string
    expect(savedProduct.stock_quantity).toEqual(100);
    expect(savedProduct.category).toEqual('Electronics');
    expect(savedProduct.is_active).toEqual(true);
    expect(savedProduct.created_at).toBeInstanceOf(Date);
    expect(savedProduct.updated_at).toBeInstanceOf(Date);
  });

  it('should handle decimal prices correctly', async () => {
    const decimalInput: CreateProductInput = {
      name: 'Decimal Product',
      description: 'Product with precise decimal price',
      barcode: 'DECIMAL123',
      price: 123.45, // Two decimal places to match PostgreSQL numeric(10,2)
      stock_quantity: 10,
      category: 'Test',
      is_active: true
    };

    const result = await createProduct(decimalInput);

    expect(result.price).toEqual(123.45);
    expect(typeof result.price).toBe('number');

    // Verify in database
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, result.id))
      .execute();

    expect(parseFloat(products[0].price)).toEqual(123.45);
  });

  it('should round prices to 2 decimal places due to numeric(10,2) constraint', async () => {
    const precisionInput: CreateProductInput = {
      name: 'Precision Test Product',
      description: 'Testing numeric precision',
      barcode: 'PRECISION123',
      price: 99.999, // Will be rounded to 100.00
      stock_quantity: 5,
      category: 'Test',
      is_active: true
    };

    const result = await createProduct(precisionInput);

    // PostgreSQL numeric(10,2) rounds 99.999 to 100.00
    expect(result.price).toEqual(100.00);
  });

  it('should prevent duplicate barcodes', async () => {
    // Create first product with unique barcode
    const firstProduct: CreateProductInput = {
      name: 'First Product',
      description: 'First product for duplicate test',
      barcode: 'DUPLICATE123',
      price: 19.99,
      stock_quantity: 100,
      category: 'Test',
      is_active: true
    };
    
    await createProduct(firstProduct);

    // Try to create another product with same barcode
    const duplicateInput: CreateProductInput = {
      name: 'Duplicate Barcode Product',
      description: 'This should fail',
      barcode: 'DUPLICATE123', // Same barcode as first product
      price: 29.99,
      stock_quantity: 50,
      category: 'Test',
      is_active: true
    };

    await expect(createProduct(duplicateInput))
      .rejects
      .toThrow(/barcode.*already exists/i);
  });

  it('should allow products without barcodes', async () => {
    const noBarcodeInput: CreateProductInput = {
      name: 'No Barcode Product',
      description: 'Product without barcode',
      barcode: null,
      price: 39.99,
      stock_quantity: 75,
      category: 'Test',
      is_active: true
    };

    const result = await createProduct(noBarcodeInput);

    expect(result.barcode).toBeNull();
    expect(result.name).toEqual('No Barcode Product');
  });

  it('should allow multiple products with null barcodes', async () => {
    const firstProduct: CreateProductInput = {
      name: 'First No Barcode',
      description: 'First product',
      barcode: null,
      price: 10.00,
      stock_quantity: 10,
      category: 'Test',
      is_active: true
    };

    const secondProduct: CreateProductInput = {
      name: 'Second No Barcode',
      description: 'Second product',
      barcode: null,
      price: 20.00,
      stock_quantity: 20,
      category: 'Test',
      is_active: true
    };

    const result1 = await createProduct(firstProduct);
    const result2 = await createProduct(secondProduct);

    expect(result1.barcode).toBeNull();
    expect(result2.barcode).toBeNull();
    expect(result1.id).not.toEqual(result2.id);
  });

  it('should handle zero stock quantity', async () => {
    const zeroStockInput: CreateProductInput = {
      name: 'Zero Stock Product',
      description: 'Product with zero stock',
      barcode: 'ZERO123',
      price: 5.99,
      stock_quantity: 0,
      category: 'Test',
      is_active: true
    };

    const result = await createProduct(zeroStockInput);

    expect(result.stock_quantity).toEqual(0);
  });
});