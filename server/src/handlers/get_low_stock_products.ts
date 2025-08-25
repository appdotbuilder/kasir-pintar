import { db } from '../db';
import { productsTable } from '../db/schema';
import { and, lt, eq } from 'drizzle-orm';
import { type Product } from '../schema';

export async function getLowStockProducts(threshold: number = 10): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(
        and(
          lt(productsTable.stock_quantity, threshold),
          eq(productsTable.is_active, true)
        )
      )
      .orderBy(productsTable.stock_quantity)
      .execute();

    // Convert numeric fields to numbers
    return results.map(product => ({
      ...product,
      price: parseFloat(product.price)
    }));
  } catch (error) {
    console.error('Failed to fetch low stock products:', error);
    throw error;
  }
}