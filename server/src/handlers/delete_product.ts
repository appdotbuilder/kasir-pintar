import { db } from '../db';
import { productsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function deleteProduct(id: number): Promise<boolean> {
  try {
    // First, check if product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error(`Product with id ${id} not found`);
    }

    // Check if product is referenced in pending transactions
    const pendingTransactionItems = await db.select()
      .from(transactionItemsTable)
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .where(
        and(
          eq(transactionItemsTable.product_id, id),
          eq(transactionsTable.status, 'pending')
        )
      )
      .execute();

    if (pendingTransactionItems.length > 0) {
      throw new Error(`Cannot delete product with id ${id}: it is referenced in pending transactions`);
    }

    // Soft delete: set is_active to false
    const result = await db.update(productsTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Product deletion failed:', error);
    throw error;
  }
}