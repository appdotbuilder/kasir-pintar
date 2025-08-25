import { db } from '../db';
import { productsTable } from '../db/schema';
import { type BarcodeSearchInput, type Product } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function searchProductByBarcode(input: BarcodeSearchInput): Promise<Product | null> {
  try {
    // Search for active product with matching barcode
    const results = await db.select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.barcode, input.barcode),
          eq(productsTable.is_active, true)
        )
      )
      .limit(1)
      .execute();

    // Return null if no product found
    if (results.length === 0) {
      return null;
    }

    // Convert numeric fields from string to number and return product
    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price) // Convert numeric column to number
    };
  } catch (error) {
    console.error('Barcode search failed:', error);
    throw error;
  }
}