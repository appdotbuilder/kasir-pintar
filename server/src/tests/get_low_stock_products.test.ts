import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput } from '../schema';
import { getLowStockProducts } from '../handlers/get_low_stock_products';

const createTestProduct = async (overrides: Partial<CreateProductInput> = {}): Promise<number> => {
  const defaultProduct: CreateProductInput = {
    name: 'Test Product',
    description: 'A test product',
    barcode: '1234567890',
    price: 10.99,
    stock_quantity: 5,
    category: 'Test Category',
    is_active: true
  };

  const productData = { ...defaultProduct, ...overrides };

  const result = await db.insert(productsTable)
    .values({
      name: productData.name,
      description: productData.description,
      barcode: productData.barcode,
      price: productData.price.toString(),
      stock_quantity: productData.stock_quantity,
      category: productData.category,
      is_active: productData.is_active
    })
    .returning({ id: productsTable.id })
    .execute();

  return result[0].id;
};

describe('getLowStockProducts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return products with stock below default threshold (10)', async () => {
    // Create products with different stock levels
    await createTestProduct({ name: 'Low Stock 1', stock_quantity: 5 });
    await createTestProduct({ name: 'Low Stock 2', stock_quantity: 8 });
    await createTestProduct({ name: 'High Stock', stock_quantity: 15 });

    const result = await getLowStockProducts();

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('Low Stock 1');
    expect(result[0].stock_quantity).toEqual(5);
    expect(result[1].name).toEqual('Low Stock 2');
    expect(result[1].stock_quantity).toEqual(8);
  });

  it('should return products with stock below custom threshold', async () => {
    await createTestProduct({ name: 'Product 1', stock_quantity: 3 });
    await createTestProduct({ name: 'Product 2', stock_quantity: 7 });
    await createTestProduct({ name: 'Product 3', stock_quantity: 12 });

    const result = await getLowStockProducts(8);

    expect(result).toHaveLength(2);
    expect(result[0].stock_quantity).toEqual(3);
    expect(result[1].stock_quantity).toEqual(7);
  });

  it('should order results by stock quantity ascending', async () => {
    await createTestProduct({ name: 'Medium Stock', stock_quantity: 7 });
    await createTestProduct({ name: 'Very Low Stock', stock_quantity: 1 });
    await createTestProduct({ name: 'Low Stock', stock_quantity: 4 });

    const result = await getLowStockProducts();

    expect(result).toHaveLength(3);
    expect(result[0].name).toEqual('Very Low Stock');
    expect(result[0].stock_quantity).toEqual(1);
    expect(result[1].name).toEqual('Low Stock');
    expect(result[1].stock_quantity).toEqual(4);
    expect(result[2].name).toEqual('Medium Stock');
    expect(result[2].stock_quantity).toEqual(7);
  });

  it('should only return active products', async () => {
    await createTestProduct({ name: 'Active Low Stock', stock_quantity: 5, is_active: true });
    await createTestProduct({ name: 'Inactive Low Stock', stock_quantity: 3, is_active: false });

    const result = await getLowStockProducts();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Active Low Stock');
    expect(result[0].is_active).toEqual(true);
  });

  it('should return empty array when no products have low stock', async () => {
    await createTestProduct({ name: 'High Stock 1', stock_quantity: 50 });
    await createTestProduct({ name: 'High Stock 2', stock_quantity: 25 });

    const result = await getLowStockProducts();

    expect(result).toHaveLength(0);
  });

  it('should handle zero stock products', async () => {
    await createTestProduct({ name: 'Out of Stock', stock_quantity: 0 });
    await createTestProduct({ name: 'High Stock', stock_quantity: 20 });

    const result = await getLowStockProducts();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Out of Stock');
    expect(result[0].stock_quantity).toEqual(0);
  });

  it('should convert numeric price field correctly', async () => {
    await createTestProduct({ 
      name: 'Low Stock Product', 
      stock_quantity: 5,
      price: 19.99
    });

    const result = await getLowStockProducts();

    expect(result).toHaveLength(1);
    expect(typeof result[0].price).toBe('number');
    expect(result[0].price).toEqual(19.99);
  });

  it('should include all product fields in response', async () => {
    const productId = await createTestProduct({ 
      name: 'Complete Product',
      description: 'Full description',
      barcode: '9876543210',
      price: 29.95,
      stock_quantity: 8,
      category: 'Electronics',
      is_active: true
    });

    const result = await getLowStockProducts();

    expect(result).toHaveLength(1);
    const product = result[0];
    expect(product.id).toEqual(productId);
    expect(product.name).toEqual('Complete Product');
    expect(product.description).toEqual('Full description');
    expect(product.barcode).toEqual('9876543210');
    expect(product.price).toEqual(29.95);
    expect(product.stock_quantity).toEqual(8);
    expect(product.category).toEqual('Electronics');
    expect(product.is_active).toEqual(true);
    expect(product.created_at).toBeInstanceOf(Date);
    expect(product.updated_at).toBeInstanceOf(Date);
  });

  it('should handle threshold of zero correctly', async () => {
    await createTestProduct({ name: 'Zero Stock', stock_quantity: 0 });
    await createTestProduct({ name: 'Positive Stock', stock_quantity: 1 });

    const result = await getLowStockProducts(0);

    expect(result).toHaveLength(0);
  });

  it('should handle very high threshold', async () => {
    await createTestProduct({ name: 'Product 1', stock_quantity: 50 });
    await createTestProduct({ name: 'Product 2', stock_quantity: 100 });

    const result = await getLowStockProducts(1000);

    expect(result).toHaveLength(2);
  });
});