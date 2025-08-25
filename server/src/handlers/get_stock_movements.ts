import { db } from '../db';
import { stockMovementsTable } from '../db/schema';
import { type StockMovement } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getStockMovements(productId?: number): Promise<StockMovement[]> {
  try {
    // Build query with conditional where clause
    const results = productId !== undefined
      ? await db.select()
          .from(stockMovementsTable)
          .where(eq(stockMovementsTable.product_id, productId))
          .orderBy(desc(stockMovementsTable.created_at))
          .execute()
      : await db.select()
          .from(stockMovementsTable)
          .orderBy(desc(stockMovementsTable.created_at))
          .execute();

    // Convert numeric fields back to numbers
    return results.map(movement => ({
      ...movement,
      // All other fields are already in correct format
      id: movement.id,
      product_id: movement.product_id,
      movement_type: movement.movement_type,
      quantity: movement.quantity,
      reference_type: movement.reference_type,
      reference_id: movement.reference_id,
      notes: movement.notes,
      created_at: movement.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch stock movements:', error);
    throw error;
  }
}