import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { type SalesReportInput, type SalesReport, type Transaction } from '../schema';
import { gte, lte, and, eq, desc, SQL } from 'drizzle-orm';

export async function getSalesReport(input: SalesReportInput): Promise<SalesReport> {
  try {
    // Calculate date ranges based on period if custom dates not provided
    const { startDate, endDate } = calculateDateRange(input);

    // Build query conditions
    const conditions: SQL<unknown>[] = [
      eq(transactionsTable.status, 'completed'), // Only include completed transactions
      gte(transactionsTable.created_at, startDate),
      lte(transactionsTable.created_at, endDate)
    ];

    // Query transactions for the period
    const transactionsQuery = db.select()
      .from(transactionsTable)
      .where(and(...conditions))
      .orderBy(desc(transactionsTable.created_at));

    const transactionResults = await transactionsQuery.execute();

    // Convert numeric fields and create transaction objects
    const transactions: Transaction[] = transactionResults.map(transaction => ({
      ...transaction,
      total_amount: parseFloat(transaction.total_amount),
      payment_amount: parseFloat(transaction.payment_amount),
      change_amount: parseFloat(transaction.change_amount)
    }));

    // Calculate aggregated statistics
    const totalSales = transactions.reduce((sum, transaction) => sum + transaction.total_amount, 0);
    const totalTransactions = transactions.length;
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    return {
      period: input.period,
      start_date: startDate,
      end_date: endDate,
      total_sales: totalSales,
      total_transactions: totalTransactions,
      average_transaction: averageTransaction,
      transactions
    };
  } catch (error) {
    console.error('Sales report generation failed:', error);
    throw error;
  }
}

function calculateDateRange(input: SalesReportInput): { startDate: Date; endDate: Date } {
  // If both custom dates provided, use them
  if (input.start_date && input.end_date) {
    return {
      startDate: input.start_date,
      endDate: input.end_date
    };
  }

  // If only start_date provided, use it with current time as end_date
  if (input.start_date && !input.end_date) {
    return {
      startDate: input.start_date,
      endDate: new Date() // Use current time as end date
    };
  }

  // If only end_date provided, calculate appropriate start_date based on period
  if (!input.start_date && input.end_date) {
    let startDate: Date;
    let endDate: Date;

    switch (input.period) {
      case 'daily': {
        // Start of the same day as input end_date
        const inputEndDate = input.end_date;
        startDate = new Date(inputEndDate.getFullYear(), inputEndDate.getMonth(), inputEndDate.getDate());
        // End of the same day
        endDate = new Date(inputEndDate.getFullYear(), inputEndDate.getMonth(), inputEndDate.getDate(), 23, 59, 59, 999);
        break;
      }
      case 'weekly': {
        // Monday of the week containing end_date, to the original end_date
        const inputEndDate = input.end_date;
        const dayOfWeek = inputEndDate.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(inputEndDate);
        startDate.setDate(inputEndDate.getDate() - daysToMonday);
        startDate.setHours(0, 0, 0, 0);
        endDate = inputEndDate; // Keep original end_date for weekly/monthly
        break;
      }
      case 'monthly': {
        // First day of the month containing end_date, to the original end_date
        const inputEndDate = input.end_date;
        startDate = new Date(inputEndDate.getFullYear(), inputEndDate.getMonth(), 1);
        endDate = inputEndDate; // Keep original end_date for weekly/monthly
        break;
      }
      default:
        throw new Error(`Invalid period: ${input.period}`);
    }

    return { startDate, endDate };
  }

  // No custom dates - calculate based on current date and period
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (input.period) {
    case 'daily': {
      // Current day from start to end
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    }
    case 'weekly': {
      // Current week (Monday to Sunday)
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday is 0, Monday is 1
      
      startDate = new Date(now);
      startDate.setDate(now.getDate() - daysToMonday);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case 'monthly': {
      // Current month from first to last day
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    default:
      throw new Error(`Invalid period: ${input.period}`);
  }

  return { startDate, endDate };
}