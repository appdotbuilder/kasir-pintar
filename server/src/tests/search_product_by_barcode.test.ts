import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type BarcodeSearchInput, type CreateProductInput } from '../schema';
import { searchProductByBarcode } from '../handlers/search_product_by_barcode';

// Test product data
const activeProduct: CreateProductInput = {
  name: 'Active Product',
  description: 'An active product with barcode',
  barcode: '1234567890123',
  price: 15.99,
  stock_quantity: 50,
  category: 'Electronics',
  is_active: true
};

const inactiveProduct: CreateProductInput = {
  name: 'Inactive Product',
  description: 'An inactive product with barcode',
  barcode: '9876543210987',
  price: 25.50,
  stock_quantity: 0,
  category: 'Books',
  is_active: false
};

const productWithoutBarcode: CreateProductInput = {
  name: 'No Barcode Product',
  description: 'A product without barcode',
  barcode: null,
  price: 9.99,
  stock_quantity: 100,
  category: 'Food',
  is_active: true
};

describe('searchProductByBarcode', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should find active product by barcode', async () => {
    // Create test product
    await db.insert(productsTable)
      .values({
        name: activeProduct.name,
        description: activeProduct.description,
        barcode: activeProduct.barcode,
        price: activeProduct.price.toString(), // Convert number to string for numeric column
        stock_quantity: activeProduct.stock_quantity,
        category: activeProduct.category,
        is_active: activeProduct.is_active
      })
      .execute();

    // Test input
    const input: BarcodeSearchInput = {
      barcode: '1234567890123'
    };

    const result = await searchProductByBarcode(input);

    expect(result).not.toBeNull();
    expect(result!.name).toEqual('Active Product');
    expect(result!.description).toEqual(activeProduct.description);
    expect(result!.barcode).toEqual('1234567890123');
    expect(result!.price).toEqual(15.99);
    expect(typeof result!.price).toEqual('number'); // Verify numeric conversion
    expect(result!.stock_quantity).toEqual(50);
    expect(result!.category).toEqual('Electronics');
    expect(result!.is_active).toBe(true);
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent barcode', async () => {
    // Create test product but search for different barcode
    await db.insert(productsTable)
      .values({
        name: activeProduct.name,
        description: activeProduct.description,
        barcode: activeProduct.barcode,
        price: activeProduct.price.toString(),
        stock_quantity: activeProduct.stock_quantity,
        category: activeProduct.category,
        is_active: activeProduct.is_active
      })
      .execute();

    const input: BarcodeSearchInput = {
      barcode: 'nonexistent123'
    };

    const result = await searchProductByBarcode(input);

    expect(result).toBeNull();
  });

  it('should return null for inactive product barcode', async () => {
    // Create inactive product
    await db.insert(productsTable)
      .values({
        name: inactiveProduct.name,
        description: inactiveProduct.description,
        barcode: inactiveProduct.barcode,
        price: inactiveProduct.price.toString(),
        stock_quantity: inactiveProduct.stock_quantity,
        category: inactiveProduct.category,
        is_active: inactiveProduct.is_active
      })
      .execute();

    const input: BarcodeSearchInput = {
      barcode: '9876543210987'
    };

    const result = await searchProductByBarcode(input);

    expect(result).toBeNull();
  });

  it('should return null when searching for null barcode', async () => {
    // Create product without barcode
    await db.insert(productsTable)
      .values({
        name: productWithoutBarcode.name,
        description: productWithoutBarcode.description,
        barcode: productWithoutBarcode.barcode,
        price: productWithoutBarcode.price.toString(),
        stock_quantity: productWithoutBarcode.stock_quantity,
        category: productWithoutBarcode.category,
        is_active: productWithoutBarcode.is_active
      })
      .execute();

    const input: BarcodeSearchInput = {
      barcode: 'null'
    };

    const result = await searchProductByBarcode(input);

    expect(result).toBeNull();
  });

  it('should handle multiple products with same barcode correctly', async () => {
    // Create active product
    await db.insert(productsTable)
      .values({
        name: 'First Product',
        description: 'First product with barcode',
        barcode: 'duplicate123',
        price: '10.00',
        stock_quantity: 10,
        category: 'Category A',
        is_active: true
      })
      .execute();

    // Create another active product with same barcode
    await db.insert(productsTable)
      .values({
        name: 'Second Product',
        description: 'Second product with same barcode',
        barcode: 'duplicate123',
        price: '20.00',
        stock_quantity: 20,
        category: 'Category B',
        is_active: true
      })
      .execute();

    const input: BarcodeSearchInput = {
      barcode: 'duplicate123'
    };

    const result = await searchProductByBarcode(input);

    // Should return one of the products (first found due to limit(1))
    expect(result).not.toBeNull();
    expect(result!.barcode).toEqual('duplicate123');
    expect(result!.is_active).toBe(true);
    expect(typeof result!.price).toEqual('number');
  });

  it('should handle empty barcode string', async () => {
    // Create active product with non-empty barcode
    await db.insert(productsTable)
      .values({
        name: activeProduct.name,
        description: activeProduct.description,
        barcode: activeProduct.barcode,
        price: activeProduct.price.toString(),
        stock_quantity: activeProduct.stock_quantity,
        category: activeProduct.category,
        is_active: activeProduct.is_active
      })
      .execute();

    const input: BarcodeSearchInput = {
      barcode: ''
    };

    const result = await searchProductByBarcode(input);

    expect(result).toBeNull();
  });

  it('should handle whitespace-only barcode', async () => {
    // Create product with actual barcode
    await db.insert(productsTable)
      .values({
        name: activeProduct.name,
        description: activeProduct.description,
        barcode: '   ',
        price: activeProduct.price.toString(),
        stock_quantity: activeProduct.stock_quantity,
        category: activeProduct.category,
        is_active: activeProduct.is_active
      })
      .execute();

    const input: BarcodeSearchInput = {
      barcode: '   '
    };

    const result = await searchProductByBarcode(input);

    // Should find the product with whitespace barcode if it exists and is active
    expect(result).not.toBeNull();
    expect(result!.barcode).toEqual('   ');
    expect(result!.is_active).toBe(true);
  });
});