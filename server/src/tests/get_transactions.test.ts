import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { getTransactions, type GetTransactionsInput } from '../handlers/get_transactions';

describe('getTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test transactions for testing
  const createTestTransaction = async (data: Partial<any> = {}) => {
    const defaultData = {
      transaction_number: `TXN-${Date.now()}-${Math.random()}`,
      total_amount: '100.00',
      payment_method: 'cash' as const,
      payment_amount: '100.00',
      change_amount: '0.00',
      status: 'completed' as const,
      notes: null
    };

    const result = await db.insert(transactionsTable)
      .values({ ...defaultData, ...data })
      .returning()
      .execute();

    return result[0];
  };

  it('should get all transactions with default pagination', async () => {
    // Create test transactions
    await createTestTransaction({ total_amount: '50.00' });
    await createTestTransaction({ total_amount: '75.25' });
    await createTestTransaction({ total_amount: '100.50' });

    const result = await getTransactions();

    expect(result).toHaveLength(3);
    expect(result[0].total_amount).toEqual(100.5); // Most recent first due to desc order
    expect(result[1].total_amount).toEqual(75.25);
    expect(result[2].total_amount).toEqual(50);

    // Verify numeric conversions
    result.forEach(transaction => {
      expect(typeof transaction.total_amount).toBe('number');
      expect(typeof transaction.payment_amount).toBe('number');
      expect(typeof transaction.change_amount).toBe('number');
    });
  });

  it('should handle pagination correctly', async () => {
    // Create 5 test transactions
    for (let i = 0; i < 5; i++) {
      await createTestTransaction({ 
        total_amount: `${10 + i}.00`,
        transaction_number: `TXN-${i}`
      });
    }

    // Test first page
    const firstPage = await getTransactions({ limit: 2, offset: 0 });
    expect(firstPage).toHaveLength(2);
    expect(firstPage[0].total_amount).toEqual(14); // Most recent

    // Test second page
    const secondPage = await getTransactions({ limit: 2, offset: 2 });
    expect(secondPage).toHaveLength(2);
    expect(secondPage[0].total_amount).toEqual(12);

    // Test last page
    const lastPage = await getTransactions({ limit: 2, offset: 4 });
    expect(lastPage).toHaveLength(1);
    expect(lastPage[0].total_amount).toEqual(10); // Oldest
  });

  it('should filter by date range', async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Create transactions at different times
    const oldTransaction = await createTestTransaction({ 
      total_amount: '50.00',
      created_at: yesterday
    });
    const recentTransaction = await createTestTransaction({ 
      total_amount: '100.00' 
    });

    // Filter to get only recent transactions
    const result = await getTransactions({
      start_date: now,
      end_date: tomorrow
    });

    expect(result).toHaveLength(1);
    expect(result[0].total_amount).toEqual(100);
    expect(result[0].id).toEqual(recentTransaction.id);
  });

  it('should filter by transaction status', async () => {
    // Create transactions with different statuses
    await createTestTransaction({ 
      status: 'pending',
      total_amount: '50.00'
    });
    await createTestTransaction({ 
      status: 'completed',
      total_amount: '100.00'
    });
    await createTestTransaction({ 
      status: 'cancelled',
      total_amount: '75.00'
    });

    // Filter by completed status
    const completedResult = await getTransactions({ status: 'completed' });
    expect(completedResult).toHaveLength(1);
    expect(completedResult[0].status).toEqual('completed');
    expect(completedResult[0].total_amount).toEqual(100);

    // Filter by pending status
    const pendingResult = await getTransactions({ status: 'pending' });
    expect(pendingResult).toHaveLength(1);
    expect(pendingResult[0].status).toEqual('pending');
    expect(pendingResult[0].total_amount).toEqual(50);
  });

  it('should filter by payment method', async () => {
    // Create transactions with different payment methods
    await createTestTransaction({ 
      payment_method: 'cash',
      total_amount: '50.00'
    });
    await createTestTransaction({ 
      payment_method: 'transfer',
      total_amount: '100.00'
    });
    await createTestTransaction({ 
      payment_method: 'e_wallet',
      total_amount: '75.00'
    });

    // Filter by cash payment
    const cashResult = await getTransactions({ payment_method: 'cash' });
    expect(cashResult).toHaveLength(1);
    expect(cashResult[0].payment_method).toEqual('cash');
    expect(cashResult[0].total_amount).toEqual(50);

    // Filter by transfer payment
    const transferResult = await getTransactions({ payment_method: 'transfer' });
    expect(transferResult).toHaveLength(1);
    expect(transferResult[0].payment_method).toEqual('transfer');
    expect(transferResult[0].total_amount).toEqual(100);
  });

  it('should combine multiple filters', async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Create transactions with different combinations
    await createTestTransaction({
      status: 'completed',
      payment_method: 'cash',
      total_amount: '50.00',
      created_at: yesterday // Outside date range
    });
    await createTestTransaction({
      status: 'completed',
      payment_method: 'cash',
      total_amount: '100.00' // Within date range, matches all filters
    });
    await createTestTransaction({
      status: 'pending',
      payment_method: 'cash',
      total_amount: '75.00' // Within date range, but different status
    });

    const result = await getTransactions({
      start_date: now,
      end_date: tomorrow,
      status: 'completed',
      payment_method: 'cash'
    });

    expect(result).toHaveLength(1);
    expect(result[0].total_amount).toEqual(100);
    expect(result[0].status).toEqual('completed');
    expect(result[0].payment_method).toEqual('cash');
  });

  it('should return empty array when no transactions exist', async () => {
    const result = await getTransactions();
    expect(result).toEqual([]);
  });

  it('should handle empty filters gracefully', async () => {
    await createTestTransaction({ total_amount: '100.00' });

    const result = await getTransactions({});
    expect(result).toHaveLength(1);
    expect(result[0].total_amount).toEqual(100);
  });

  it('should sort transactions by created_at descending', async () => {
    const now = new Date();
    const hour1 = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour later
    const hour2 = new Date(now.getTime() + 2000 * 60 * 60); // 2 hours later

    // Create transactions in non-chronological order
    await createTestTransaction({ 
      total_amount: '100.00',
      created_at: hour1
    });
    await createTestTransaction({ 
      total_amount: '200.00',
      created_at: hour2
    });
    await createTestTransaction({ 
      total_amount: '50.00',
      created_at: now
    });

    const result = await getTransactions();

    expect(result).toHaveLength(3);
    // Should be ordered newest first
    expect(result[0].total_amount).toEqual(200); // hour2 - newest
    expect(result[1].total_amount).toEqual(100); // hour1 - middle
    expect(result[2].total_amount).toEqual(50);  // now - oldest
  });

  it('should verify all required fields are present', async () => {
    const transaction = await createTestTransaction({
      transaction_number: 'TXN-TEST-001',
      total_amount: '123.45',
      payment_method: 'transfer',
      payment_amount: '150.00',
      change_amount: '26.55',
      status: 'completed',
      notes: 'Test transaction'
    });

    const result = await getTransactions();

    expect(result).toHaveLength(1);
    const returnedTransaction = result[0];

    expect(returnedTransaction.id).toBeDefined();
    expect(returnedTransaction.transaction_number).toEqual('TXN-TEST-001');
    expect(returnedTransaction.total_amount).toEqual(123.45);
    expect(returnedTransaction.payment_method).toEqual('transfer');
    expect(returnedTransaction.payment_amount).toEqual(150);
    expect(returnedTransaction.change_amount).toEqual(26.55);
    expect(returnedTransaction.status).toEqual('completed');
    expect(returnedTransaction.notes).toEqual('Test transaction');
    expect(returnedTransaction.created_at).toBeInstanceOf(Date);
    expect(returnedTransaction.updated_at).toBeInstanceOf(Date);
  });
});