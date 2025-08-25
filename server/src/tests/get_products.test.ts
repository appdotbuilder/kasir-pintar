import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput } from '../schema';
import { getProducts, type GetProductsFilters } from '../handlers/get_products';

// Test products for various scenarios
const testProducts: CreateProductInput[] = [
  {
    name: 'Laptop Dell XPS',
    description: 'High-performance laptop for professionals',
    barcode: '1234567890123',
    price: 1299.99,
    stock_quantity: 10,
    category: 'Electronics',
    is_active: true
  },
  {
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with RGB lighting',
    barcode: '2345678901234',
    price: 49.99,
    stock_quantity: 25,
    category: 'Electronics',
    is_active: true
  },
  {
    name: 'Coffee Mug',
    description: 'Ceramic coffee mug with company logo',
    barcode: '3456789012345',
    price: 12.99,
    stock_quantity: 50,
    category: 'Accessories',
    is_active: true
  },
  {
    name: 'Inactive Product',
    description: 'This product should not appear in default results',
    barcode: '4567890123456',
    price: 99.99,
    stock_quantity: 0,
    category: 'Electronics',
    is_active: false
  },
  {
    name: 'Out of Stock Item',
    description: 'Product with zero stock',
    barcode: '5678901234567',
    price: 29.99,
    stock_quantity: 0,
    category: 'Accessories',
    is_active: true
  }
];

describe('getProducts', () => {
  beforeEach(async () => {
    await createDB();
    
    // Insert test products
    for (const product of testProducts) {
      await db.insert(productsTable).values({
        ...product,
        price: product.price.toString() // Convert to string for numeric column
      }).execute();
    }
  });

  afterEach(resetDB);

  it('should get all active products by default', async () => {
    const results = await getProducts();

    // Should get all active products (4 out of 5)
    expect(results).toHaveLength(4);
    
    // Verify all returned products are active
    results.forEach(product => {
      expect(product.is_active).toBe(true);
    });

    // Verify numeric conversion
    results.forEach(product => {
      expect(typeof product.price).toBe('number');
    });

    // Should be ordered by created_at desc by default
    expect(results[0].name).toBe('Out of Stock Item'); // Last inserted
  });

  it('should include inactive products when is_active is false', async () => {
    const filters: GetProductsFilters = {
      is_active: false
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Inactive Product');
    expect(results[0].is_active).toBe(false);
  });

  it('should filter by search term in name', async () => {
    const filters: GetProductsFilters = {
      search: 'laptop'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Laptop Dell XPS');
  });

  it('should filter by search term in description', async () => {
    const filters: GetProductsFilters = {
      search: 'wireless'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Wireless Mouse');
  });

  it('should filter by search term in barcode', async () => {
    const filters: GetProductsFilters = {
      search: '1234567890123'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Laptop Dell XPS');
  });

  it('should filter by category', async () => {
    const filters: GetProductsFilters = {
      category: 'Electronics'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(2);
    results.forEach(product => {
      expect(product.category).toBe('Electronics');
    });
  });

  it('should combine search and category filters', async () => {
    const filters: GetProductsFilters = {
      search: 'mouse',
      category: 'Electronics'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Wireless Mouse');
    expect(results[0].category).toBe('Electronics');
  });

  it('should order by name ascending', async () => {
    const filters: GetProductsFilters = {
      orderBy: 'name',
      orderDirection: 'asc'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(4);
    expect(results[0].name).toBe('Coffee Mug');
    expect(results[1].name).toBe('Laptop Dell XPS');
    expect(results[2].name).toBe('Out of Stock Item');
    expect(results[3].name).toBe('Wireless Mouse');
  });

  it('should order by price descending', async () => {
    const filters: GetProductsFilters = {
      orderBy: 'price',
      orderDirection: 'desc'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(4);
    expect(results[0].price).toBe(1299.99);
    expect(results[1].price).toBe(49.99);
    expect(results[2].price).toBe(29.99);
    expect(results[3].price).toBe(12.99);
  });

  it('should order by stock quantity ascending', async () => {
    const filters: GetProductsFilters = {
      orderBy: 'stock_quantity',
      orderDirection: 'asc'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(4);
    expect(results[0].stock_quantity).toBe(0);
    expect(results[1].stock_quantity).toBe(10);
    expect(results[2].stock_quantity).toBe(25);
    expect(results[3].stock_quantity).toBe(50);
  });

  it('should apply pagination with limit', async () => {
    const filters: GetProductsFilters = {
      limit: 2
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(2);
  });

  it('should apply pagination with offset', async () => {
    const filters: GetProductsFilters = {
      orderBy: 'name',
      orderDirection: 'asc',
      offset: 1,
      limit: 2
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Laptop Dell XPS');
    expect(results[1].name).toBe('Out of Stock Item');
  });

  it('should handle empty search results', async () => {
    const filters: GetProductsFilters = {
      search: 'nonexistent'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(0);
  });

  it('should handle empty category filter', async () => {
    const filters: GetProductsFilters = {
      category: 'NonexistentCategory'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(0);
  });

  it('should handle case-insensitive search', async () => {
    const filters: GetProductsFilters = {
      search: 'LAPTOP'
    };

    const results = await getProducts(filters);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Laptop Dell XPS');
  });

  it('should return products with all required fields', async () => {
    const results = await getProducts();

    expect(results.length).toBeGreaterThan(0);
    
    const product = results[0];
    expect(product.id).toBeDefined();
    expect(product.name).toBeDefined();
    expect(typeof product.name).toBe('string');
    expect(typeof product.price).toBe('number');
    expect(typeof product.stock_quantity).toBe('number');
    expect(typeof product.is_active).toBe('boolean');
    expect(product.created_at).toBeInstanceOf(Date);
    expect(product.updated_at).toBeInstanceOf(Date);
  });

  it('should apply default pagination limits', async () => {
    // Insert many more products to test default limit
    const manyProducts: CreateProductInput[] = Array.from({ length: 150 }, (_, i) => ({
      name: `Product ${i + 6}`,
      description: `Description for product ${i + 6}`,
      barcode: `${6000000000000 + i}`,
      price: 10.99,
      stock_quantity: 1,
      category: 'Test',
      is_active: true
    }));

    for (const product of manyProducts) {
      await db.insert(productsTable).values({
        ...product,
        price: product.price.toString()
      }).execute();
    }

    const results = await getProducts();

    // Should be limited to default 100
    expect(results).toHaveLength(100);
  });
});