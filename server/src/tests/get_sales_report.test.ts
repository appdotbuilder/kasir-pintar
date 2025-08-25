import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, transactionItemsTable, productsTable } from '../db/schema';
import { type SalesReportInput } from '../schema';
import { getSalesReport } from '../handlers/get_sales_report';

// Helper function to create test products
async function createTestProduct(name: string, price: number) {
  const result = await db.insert(productsTable)
    .values({
      name,
      description: `Test ${name}`,
      barcode: `${Date.now()}-${Math.random()}`,
      price: price.toString(),
      stock_quantity: 100,
      category: 'test',
      is_active: true
    })
    .returning()
    .execute();

  return result[0];
}

// Helper function to create test transactions
async function createTestTransaction(totalAmount: number, createdAt: Date, status: 'pending' | 'completed' | 'cancelled' = 'completed') {
  const transactionNumber = `TXN-${Date.now()}-${Math.random()}`;
  
  const result = await db.insert(transactionsTable)
    .values({
      transaction_number: transactionNumber,
      total_amount: totalAmount.toString(),
      payment_method: 'cash',
      payment_amount: totalAmount.toString(),
      change_amount: '0',
      status,
      notes: null,
      created_at: createdAt,
      updated_at: createdAt
    })
    .returning()
    .execute();

  return result[0];
}

describe('getSalesReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('daily reports', () => {
    it('should generate daily report for current day', async () => {
      // Create test transactions for today
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      await createTestTransaction(100.50, todayStart);
      await createTestTransaction(75.25, new Date(todayStart.getTime() + 3600000)); // 1 hour later
      
      // Create transaction for yesterday (should not be included)
      const yesterday = new Date(todayStart);
      yesterday.setDate(yesterday.getDate() - 1);
      await createTestTransaction(50.00, yesterday);

      const input: SalesReportInput = { period: 'daily' };
      const result = await getSalesReport(input);

      expect(result.period).toEqual('daily');
      expect(result.total_sales).toEqual(175.75);
      expect(result.total_transactions).toEqual(2);
      expect(result.average_transaction).toBeCloseTo(87.875);
      expect(result.transactions).toHaveLength(2);
      expect(result.start_date.getDate()).toEqual(today.getDate());
    });

    it('should handle empty daily report', async () => {
      const input: SalesReportInput = { period: 'daily' };
      const result = await getSalesReport(input);

      expect(result.period).toEqual('daily');
      expect(result.total_sales).toEqual(0);
      expect(result.total_transactions).toEqual(0);
      expect(result.average_transaction).toEqual(0);
      expect(result.transactions).toHaveLength(0);
    });
  });

  describe('weekly reports', () => {
    it('should generate weekly report for current week', async () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      // Monday of current week
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysToMonday);
      monday.setHours(0, 0, 0, 0);

      // Create transactions throughout the week
      await createTestTransaction(200.00, monday);
      await createTestTransaction(150.50, new Date(monday.getTime() + 86400000)); // Tuesday
      await createTestTransaction(300.25, new Date(monday.getTime() + 2 * 86400000)); // Wednesday

      // Create transaction from previous week (should not be included)
      const previousWeek = new Date(monday);
      previousWeek.setDate(previousWeek.getDate() - 7);
      await createTestTransaction(100.00, previousWeek);

      const input: SalesReportInput = { period: 'weekly' };
      const result = await getSalesReport(input);

      expect(result.period).toEqual('weekly');
      expect(result.total_sales).toEqual(650.75);
      expect(result.total_transactions).toEqual(3);
      expect(result.average_transaction).toBeCloseTo(216.92, 2);
      expect(result.transactions).toHaveLength(3);
    });
  });

  describe('monthly reports', () => {
    it('should generate monthly report for current month', async () => {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const midMonth = new Date(now.getFullYear(), now.getMonth(), 15);
      
      // Create transactions in current month
      await createTestTransaction(500.00, firstOfMonth);
      await createTestTransaction(250.75, midMonth);
      await createTestTransaction(125.50, now);

      // Create transaction from previous month (should not be included)
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      await createTestTransaction(300.00, previousMonth);

      const input: SalesReportInput = { period: 'monthly' };
      const result = await getSalesReport(input);

      expect(result.period).toEqual('monthly');
      expect(result.total_sales).toEqual(876.25);
      expect(result.total_transactions).toEqual(3);
      expect(result.average_transaction).toBeCloseTo(292.08, 2);
      expect(result.transactions).toHaveLength(3);
      expect(result.start_date.getDate()).toEqual(1);
      expect(result.start_date.getMonth()).toEqual(now.getMonth());
    });
  });

  describe('custom date ranges', () => {
    it('should generate report for custom date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const midDate = new Date('2024-01-15');

      // Create transactions within range
      await createTestTransaction(100.00, startDate);
      await createTestTransaction(200.00, midDate);
      await createTestTransaction(150.00, endDate);

      // Create transaction outside range
      const outsideDate = new Date('2024-02-01');
      await createTestTransaction(300.00, outsideDate);

      const input: SalesReportInput = {
        period: 'daily', // Period becomes less relevant with custom dates
        start_date: startDate,
        end_date: endDate
      };

      const result = await getSalesReport(input);

      expect(result.period).toEqual('daily');
      expect(result.start_date).toEqual(startDate);
      expect(result.end_date).toEqual(endDate);
      expect(result.total_sales).toEqual(450.00);
      expect(result.total_transactions).toEqual(3);
      expect(result.average_transaction).toEqual(150.00);
      expect(result.transactions).toHaveLength(3);
    });

    it('should handle partial custom date range - start_date only', async () => {
      const customStart = new Date('2024-01-15');
      const today = new Date();
      
      // Create transactions after custom start date
      await createTestTransaction(100.00, customStart);
      await createTestTransaction(200.00, today);

      // Create transaction before custom start date (should not be included)
      const beforeStart = new Date('2024-01-10');
      await createTestTransaction(50.00, beforeStart);

      const input: SalesReportInput = {
        period: 'daily',
        start_date: customStart
      };

      const result = await getSalesReport(input);

      expect(result.start_date).toEqual(customStart);
      expect(result.total_sales).toEqual(300.00);
      expect(result.total_transactions).toEqual(2);
    });

    it('should handle partial custom date range - end_date only (daily)', async () => {
      const customEnd = new Date('2024-01-31'); // Any time on this day
      const morningOfSameDay = new Date('2024-01-31T10:00:00.000Z');
      const midnightOfSameDay = new Date('2024-01-31T00:00:00.000Z');
      
      // Create transactions on the same day as end_date
      await createTestTransaction(100.00, midnightOfSameDay);
      await createTestTransaction(200.00, morningOfSameDay);

      // Create transaction on different day (should not be included with daily period)
      const differentDay = new Date('2024-01-15T12:00:00.000Z');
      await createTestTransaction(50.00, differentDay);

      // Create transaction after custom end date (should not be included)
      const afterEnd = new Date('2024-02-01T00:00:00.000Z');
      await createTestTransaction(75.00, afterEnd);

      const input: SalesReportInput = {
        period: 'daily',
        end_date: customEnd
      };

      const result = await getSalesReport(input);

      // For daily period with end_date only, the result should use end-of-day
      const expectedEndDate = new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59, 999);
      expect(result.end_date).toEqual(expectedEndDate);
      expect(result.total_sales).toEqual(300.00);
      expect(result.total_transactions).toEqual(2);
      // Should only include transactions from the same day as the end_date when period is 'daily'
    });

    it('should handle partial custom date range - end_date only (monthly)', async () => {
      const customEnd = new Date('2024-01-31');
      const beginningOfMonth = new Date('2024-01-01');
      const middleOfMonth = new Date('2024-01-15');
      
      // Create transactions within the same month as end_date
      await createTestTransaction(100.00, beginningOfMonth);
      await createTestTransaction(150.00, middleOfMonth);
      await createTestTransaction(200.00, customEnd);

      // Create transaction from different month (should not be included)
      const differentMonth = new Date('2023-12-31');
      await createTestTransaction(50.00, differentMonth);

      // Create transaction after custom end date (should not be included)
      const afterEnd = new Date('2024-02-01');
      await createTestTransaction(75.00, afterEnd);

      const input: SalesReportInput = {
        period: 'monthly',
        end_date: customEnd
      };

      const result = await getSalesReport(input);

      expect(result.end_date).toEqual(customEnd);
      expect(result.total_sales).toEqual(450.00);
      expect(result.total_transactions).toEqual(3);
      // Should include all transactions from the same month as the end_date when period is 'monthly'
    });
  });

  describe('transaction status filtering', () => {
    it('should only include completed transactions', async () => {
      const today = new Date();

      // Create transactions with different statuses
      await createTestTransaction(100.00, today, 'completed');
      await createTestTransaction(200.00, today, 'pending');
      await createTestTransaction(150.00, today, 'cancelled');
      await createTestTransaction(75.00, today, 'completed');

      const input: SalesReportInput = { period: 'daily' };
      const result = await getSalesReport(input);

      // Should only include the two completed transactions
      expect(result.total_sales).toEqual(175.00);
      expect(result.total_transactions).toEqual(2);
      expect(result.average_transaction).toEqual(87.50);
      expect(result.transactions).toHaveLength(2);
      
      // Verify all returned transactions are completed
      result.transactions.forEach(transaction => {
        expect(transaction.status).toEqual('completed');
      });
    });
  });

  describe('transaction data conversion', () => {
    it('should properly convert numeric fields', async () => {
      const today = new Date();
      await createTestTransaction(123.45, today);

      const input: SalesReportInput = { period: 'daily' };
      const result = await getSalesReport(input);

      expect(result.transactions).toHaveLength(1);
      const transaction = result.transactions[0];
      
      // Verify numeric fields are properly converted
      expect(typeof transaction.total_amount).toBe('number');
      expect(typeof transaction.payment_amount).toBe('number');
      expect(typeof transaction.change_amount).toBe('number');
      expect(transaction.total_amount).toEqual(123.45);
    });
  });

  describe('transaction ordering', () => {
    it('should return transactions ordered by created_at descending', async () => {
      const baseDate = new Date();
      
      // Create transactions at different times
      const firstTransaction = await createTestTransaction(100.00, new Date(baseDate.getTime() - 3600000)); // 1 hour ago
      const secondTransaction = await createTestTransaction(200.00, new Date(baseDate.getTime() - 1800000)); // 30 min ago
      const thirdTransaction = await createTestTransaction(300.00, baseDate); // now

      const input: SalesReportInput = { period: 'daily' };
      const result = await getSalesReport(input);

      expect(result.transactions).toHaveLength(3);
      
      // Should be ordered by created_at descending (newest first)
      expect(result.transactions[0].id).toEqual(thirdTransaction.id);
      expect(result.transactions[1].id).toEqual(secondTransaction.id);
      expect(result.transactions[2].id).toEqual(firstTransaction.id);
    });
  });

  describe('edge cases', () => {
    it('should handle zero transaction amounts', async () => {
      const today = new Date();
      await createTestTransaction(0.00, today);

      const input: SalesReportInput = { period: 'daily' };
      const result = await getSalesReport(input);

      expect(result.total_sales).toEqual(0);
      expect(result.total_transactions).toEqual(1);
      expect(result.average_transaction).toEqual(0);
    });

    it('should handle large transaction amounts', async () => {
      const today = new Date();
      const largeAmount = 9999.99;
      await createTestTransaction(largeAmount, today);

      const input: SalesReportInput = { period: 'daily' };
      const result = await getSalesReport(input);

      expect(result.total_sales).toEqual(largeAmount);
      expect(result.total_transactions).toEqual(1);
      expect(result.average_transaction).toEqual(largeAmount);
    });

    it('should handle date range with no transactions', async () => {
      const futureStart = new Date('2025-01-01');
      const futureEnd = new Date('2025-01-31');

      const input: SalesReportInput = {
        period: 'daily',
        start_date: futureStart,
        end_date: futureEnd
      };

      const result = await getSalesReport(input);

      expect(result.total_sales).toEqual(0);
      expect(result.total_transactions).toEqual(0);
      expect(result.average_transaction).toEqual(0);
      expect(result.transactions).toHaveLength(0);
    });
  });
});