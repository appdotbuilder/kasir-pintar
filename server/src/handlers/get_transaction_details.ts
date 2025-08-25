import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { type TransactionWithItems } from '../schema';
import { eq } from 'drizzle-orm';

export async function getTransactionDetails(id: number): Promise<TransactionWithItems | null> {
  try {
    // First get the transaction
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .execute();

    if (transactions.length === 0) {
      return null;
    }

    const transaction = transactions[0];

    // Get all transaction items
    const items = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, id))
      .execute();

    // Convert numeric fields and return the complete transaction with items
    return {
      id: transaction.id,
      transaction_number: transaction.transaction_number,
      total_amount: parseFloat(transaction.total_amount),
      payment_method: transaction.payment_method,
      payment_amount: parseFloat(transaction.payment_amount),
      change_amount: parseFloat(transaction.change_amount),
      status: transaction.status,
      notes: transaction.notes,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
      items: items.map(item => ({
        id: item.id,
        transaction_id: item.transaction_id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.total_price),
        created_at: item.created_at
      }))
    };
  } catch (error) {
    console.error('Get transaction details failed:', error);
    throw error;
  }
}