import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type Transaction } from '../schema';
import { desc, gte, lte, eq, and, type SQL } from 'drizzle-orm';

// Input type for filtering and pagination
export interface GetTransactionsInput {
  limit?: number;
  offset?: number;
  start_date?: Date;
  end_date?: Date;
  status?: 'pending' | 'completed' | 'cancelled';
  payment_method?: 'cash' | 'transfer' | 'e_wallet';
}

export const getTransactions = async (input: GetTransactionsInput = {}): Promise<Transaction[]> => {
  try {
    // Set defaults for pagination
    const limit = input.limit ?? 20;
    const offset = input.offset ?? 0;

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (input.start_date) {
      conditions.push(gte(transactionsTable.created_at, input.start_date));
    }

    if (input.end_date) {
      conditions.push(lte(transactionsTable.created_at, input.end_date));
    }

    if (input.status) {
      conditions.push(eq(transactionsTable.status, input.status));
    }

    if (input.payment_method) {
      conditions.push(eq(transactionsTable.payment_method, input.payment_method));
    }

    // Build query with all conditions in one chain
    const queryBuilder = db.select().from(transactionsTable);

    // Apply filters if we have conditions
    const queryWithFilters = conditions.length > 0 
      ? queryBuilder.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : queryBuilder;

    // Apply ordering and pagination in final chain
    const finalQuery = queryWithFilters
      .orderBy(desc(transactionsTable.created_at))
      .limit(limit)
      .offset(offset);

    const results = await finalQuery.execute();

    // Convert numeric fields back to numbers before returning
    return results.map(transaction => ({
      ...transaction,
      total_amount: parseFloat(transaction.total_amount),
      payment_amount: parseFloat(transaction.payment_amount),
      change_amount: parseFloat(transaction.change_amount)
    }));
  } catch (error) {
    console.error('Get transactions failed:', error);
    throw error;
  }
};