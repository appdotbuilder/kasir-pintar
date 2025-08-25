import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { getDashboardStats } from '../handlers/get_dashboard_stats';

describe('getDashboardStats', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty stats when no data exists', async () => {
    const stats = await getDashboardStats();

    expect(stats.total_sales_today).toEqual(0);
    expect(stats.total_transactions_today).toEqual(0);
    expect(stats.low_stock_products).toEqual(0);
    expect(stats.total_revenue_month).toEqual(0);
    expect(stats.top_selling_products).toEqual([]);
  });

  it('should calculate today\'s sales and transaction count', async () => {
    // Create test products
    const product1 = await db.insert(productsTable)
      .values({
        name: 'Product 1',
        description: 'Test product 1',
        barcode: '123456789',
        price: '10.00',
        stock_quantity: 50,
        category: 'Electronics',
        is_active: true
      })
      .returning()
      .execute();

    const product2 = await db.insert(productsTable)
      .values({
        name: 'Product 2',
        description: 'Test product 2',
        barcode: '987654321',
        price: '25.50',
        stock_quantity: 30,
        category: 'Books',
        is_active: true
      })
      .returning()
      .execute();

    // Create today's transactions
    const today = new Date();
    
    const transaction1 = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-001',
        total_amount: '35.50',
        payment_method: 'cash',
        payment_amount: '40.00',
        change_amount: '4.50',
        status: 'completed',
        notes: null
      })
      .returning()
      .execute();

    const transaction2 = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-002',
        total_amount: '51.00',
        payment_method: 'transfer',
        payment_amount: '51.00',
        change_amount: '0.00',
        status: 'completed',
        notes: null
      })
      .returning()
      .execute();

    // Create transaction items
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transaction1[0].id,
        product_id: product1[0].id,
        product_name: product1[0].name,
        quantity: 1,
        unit_price: '10.00',
        total_price: '10.00'
      })
      .execute();

    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transaction1[0].id,
        product_id: product2[0].id,
        product_name: product2[0].name,
        quantity: 1,
        unit_price: '25.50',
        total_price: '25.50'
      })
      .execute();

    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transaction2[0].id,
        product_id: product2[0].id,
        product_name: product2[0].name,
        quantity: 2,
        unit_price: '25.50',
        total_price: '51.00'
      })
      .execute();

    const stats = await getDashboardStats();

    expect(stats.total_sales_today).toEqual(86.50);
    expect(stats.total_transactions_today).toEqual(2);
    expect(typeof stats.total_sales_today).toBe('number');
    expect(typeof stats.total_transactions_today).toBe('number');
  });

  it('should calculate monthly revenue correctly', async () => {
    // Create test product
    const product = await db.insert(productsTable)
      .values({
        name: 'Monthly Product',
        description: 'Test product for monthly stats',
        barcode: '111222333',
        price: '15.00',
        stock_quantity: 100,
        category: 'Test',
        is_active: true
      })
      .returning()
      .execute();

    // Create transaction from earlier this month
    const earlierThisMonth = new Date();
    earlierThisMonth.setDate(5); // Set to 5th of current month
    earlierThisMonth.setHours(10, 0, 0, 0);

    const oldTransaction = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-OLD',
        total_amount: '30.00',
        payment_method: 'cash',
        payment_amount: '30.00',
        change_amount: '0.00',
        status: 'completed',
        notes: null,
        created_at: earlierThisMonth
      })
      .returning()
      .execute();

    // Create today's transaction
    const todayTransaction = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-TODAY',
        total_amount: '45.00',
        payment_method: 'transfer',
        payment_amount: '45.00',
        change_amount: '0.00',
        status: 'completed',
        notes: null
      })
      .returning()
      .execute();

    const stats = await getDashboardStats();

    expect(stats.total_revenue_month).toEqual(75.00);
    expect(typeof stats.total_revenue_month).toBe('number');
  });

  it('should count low stock products correctly', async () => {
    // Create products with different stock levels
    await db.insert(productsTable)
      .values([
        {
          name: 'High Stock Product',
          description: 'Plenty in stock',
          price: '10.00',
          stock_quantity: 50,
          is_active: true
        },
        {
          name: 'Low Stock Product 1',
          description: 'Running low',
          price: '20.00',
          stock_quantity: 5,
          is_active: true
        },
        {
          name: 'Low Stock Product 2',
          description: 'Very low stock',
          price: '30.00',
          stock_quantity: 2,
          is_active: true
        },
        {
          name: 'Zero Stock Product',
          description: 'Out of stock',
          price: '40.00',
          stock_quantity: 0,
          is_active: true
        },
        {
          name: 'Inactive Low Stock',
          description: 'Inactive product with low stock',
          price: '50.00',
          stock_quantity: 3,
          is_active: false
        }
      ])
      .execute();

    const stats = await getDashboardStats();

    // Should count 3 active products with stock < 10
    expect(stats.low_stock_products).toEqual(3);
    expect(typeof stats.low_stock_products).toBe('number');
  });

  it('should get top selling products with revenue data', async () => {
    // Create test products
    const products = await db.insert(productsTable)
      .values([
        {
          name: 'Best Seller',
          price: '10.00',
          stock_quantity: 100,
          is_active: true
        },
        {
          name: 'Second Best',
          price: '20.00',
          stock_quantity: 80,
          is_active: true
        },
        {
          name: 'Third Place',
          price: '15.00',
          stock_quantity: 60,
          is_active: true
        }
      ])
      .returning()
      .execute();

    // Create transactions
    const transactions = await db.insert(transactionsTable)
      .values([
        {
          transaction_number: 'TXN-TOP-1',
          total_amount: '100.00',
          payment_method: 'cash',
          payment_amount: '100.00',
          change_amount: '0.00',
          status: 'completed'
        },
        {
          transaction_number: 'TXN-TOP-2',
          total_amount: '80.00',
          payment_method: 'transfer',
          payment_amount: '80.00',
          change_amount: '0.00',
          status: 'completed'
        }
      ])
      .returning()
      .execute();

    // Create transaction items with different quantities
    await db.insert(transactionItemsTable)
      .values([
        // Best seller: 10 units sold
        {
          transaction_id: transactions[0].id,
          product_id: products[0].id,
          product_name: products[0].name,
          quantity: 8,
          unit_price: '10.00',
          total_price: '80.00'
        },
        {
          transaction_id: transactions[1].id,
          product_id: products[0].id,
          product_name: products[0].name,
          quantity: 2,
          unit_price: '10.00',
          total_price: '20.00'
        },
        // Second best: 4 units sold
        {
          transaction_id: transactions[0].id,
          product_id: products[1].id,
          product_name: products[1].name,
          quantity: 1,
          unit_price: '20.00',
          total_price: '20.00'
        },
        {
          transaction_id: transactions[1].id,
          product_id: products[1].id,
          product_name: products[1].name,
          quantity: 3,
          unit_price: '20.00',
          total_price: '60.00'
        },
        // Third place: 2 units sold
        {
          transaction_id: transactions[1].id,
          product_id: products[2].id,
          product_name: products[2].name,
          quantity: 2,
          unit_price: '15.00',
          total_price: '30.00'
        }
      ])
      .execute();

    const stats = await getDashboardStats();

    expect(stats.top_selling_products).toHaveLength(3);
    
    // Check ordering by quantity sold (descending)
    expect(stats.top_selling_products[0].product_name).toEqual('Best Seller');
    expect(stats.top_selling_products[0].total_sold).toEqual(10);
    expect(stats.top_selling_products[0].revenue).toEqual(100.00);
    
    expect(stats.top_selling_products[1].product_name).toEqual('Second Best');
    expect(stats.top_selling_products[1].total_sold).toEqual(4);
    expect(stats.top_selling_products[1].revenue).toEqual(80.00);
    
    expect(stats.top_selling_products[2].product_name).toEqual('Third Place');
    expect(stats.top_selling_products[2].total_sold).toEqual(2);
    expect(stats.top_selling_products[2].revenue).toEqual(30.00);

    // Verify data types
    stats.top_selling_products.forEach(product => {
      expect(typeof product.product_id).toBe('number');
      expect(typeof product.product_name).toBe('string');
      expect(typeof product.total_sold).toBe('number');
      expect(typeof product.revenue).toBe('number');
    });
  });

  it('should only include completed transactions in calculations', async () => {
    // Create test product
    const product = await db.insert(productsTable)
      .values({
        name: 'Status Test Product',
        price: '25.00',
        stock_quantity: 50,
        is_active: true
      })
      .returning()
      .execute();

    // Create transactions with different statuses
    const transactions = await db.insert(transactionsTable)
      .values([
        {
          transaction_number: 'TXN-COMPLETED',
          total_amount: '25.00',
          payment_method: 'cash',
          payment_amount: '25.00',
          change_amount: '0.00',
          status: 'completed'
        },
        {
          transaction_number: 'TXN-PENDING',
          total_amount: '50.00',
          payment_method: 'transfer',
          payment_amount: '50.00',
          change_amount: '0.00',
          status: 'pending'
        },
        {
          transaction_number: 'TXN-CANCELLED',
          total_amount: '75.00',
          payment_method: 'cash',
          payment_amount: '75.00',
          change_amount: '0.00',
          status: 'cancelled'
        }
      ])
      .returning()
      .execute();

    // Create transaction items for all transactions
    await db.insert(transactionItemsTable)
      .values([
        {
          transaction_id: transactions[0].id,
          product_id: product[0].id,
          product_name: product[0].name,
          quantity: 1,
          unit_price: '25.00',
          total_price: '25.00'
        },
        {
          transaction_id: transactions[1].id,
          product_id: product[0].id,
          product_name: product[0].name,
          quantity: 2,
          unit_price: '25.00',
          total_price: '50.00'
        },
        {
          transaction_id: transactions[2].id,
          product_id: product[0].id,
          product_name: product[0].name,
          quantity: 3,
          unit_price: '25.00',
          total_price: '75.00'
        }
      ])
      .execute();

    const stats = await getDashboardStats();

    // Should only count completed transactions
    expect(stats.total_sales_today).toEqual(25.00);
    expect(stats.total_transactions_today).toEqual(1);
    expect(stats.total_revenue_month).toEqual(25.00);
    
    // Top selling should only include completed transaction items
    expect(stats.top_selling_products).toHaveLength(1);
    expect(stats.top_selling_products[0].total_sold).toEqual(1);
    expect(stats.top_selling_products[0].revenue).toEqual(25.00);
  });

  it('should limit top selling products to 5 items', async () => {
    // Create 7 test products
    const products = await db.insert(productsTable)
      .values([
        { name: 'Product 1', price: '10.00', stock_quantity: 100, is_active: true },
        { name: 'Product 2', price: '10.00', stock_quantity: 100, is_active: true },
        { name: 'Product 3', price: '10.00', stock_quantity: 100, is_active: true },
        { name: 'Product 4', price: '10.00', stock_quantity: 100, is_active: true },
        { name: 'Product 5', price: '10.00', stock_quantity: 100, is_active: true },
        { name: 'Product 6', price: '10.00', stock_quantity: 100, is_active: true },
        { name: 'Product 7', price: '10.00', stock_quantity: 100, is_active: true }
      ])
      .returning()
      .execute();

    // Create a transaction
    const transaction = await db.insert(transactionsTable)
      .values({
        transaction_number: 'TXN-LIMIT-TEST',
        total_amount: '70.00',
        payment_method: 'cash',
        payment_amount: '70.00',
        change_amount: '0.00',
        status: 'completed'
      })
      .returning()
      .execute();

    // Create transaction items for all products with different quantities
    const items = products.map((product, index) => ({
      transaction_id: transaction[0].id,
      product_id: product.id,
      product_name: product.name,
      quantity: 7 - index, // 7, 6, 5, 4, 3, 2, 1
      unit_price: '10.00',
      total_price: ((7 - index) * 10).toString()
    }));

    await db.insert(transactionItemsTable).values(items).execute();

    const stats = await getDashboardStats();

    // Should only return top 5 products
    expect(stats.top_selling_products).toHaveLength(5);
    
    // Should be ordered by quantity sold (descending)
    expect(stats.top_selling_products[0].product_name).toEqual('Product 1');
    expect(stats.top_selling_products[0].total_sold).toEqual(7);
    expect(stats.top_selling_products[4].product_name).toEqual('Product 5');
    expect(stats.top_selling_products[4].total_sold).toEqual(3);
  });
});