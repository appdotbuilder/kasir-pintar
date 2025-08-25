import { db } from '../db';
import { productsTable, stockMovementsTable } from '../db/schema';
import { type StockAdjustmentInput, type Product } from '../schema';
import { eq } from 'drizzle-orm';

export async function adjustStock(input: StockAdjustmentInput): Promise<Product> {
  try {
    // Get current product to validate it exists and calculate new stock
    const existingProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.product_id))
      .execute();

    if (existingProducts.length === 0) {
      throw new Error('Product not found');
    }

    const currentProduct = existingProducts[0];
    const newStockQuantity = currentProduct.stock_quantity + input.adjustment_quantity;

    // Validate that final stock quantity is not negative
    if (newStockQuantity < 0) {
      throw new Error('Stock adjustment would result in negative stock quantity');
    }

    // Update product stock quantity
    const updatedProducts = await db.update(productsTable)
      .set({ 
        stock_quantity: newStockQuantity,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, input.product_id))
      .returning()
      .execute();

    // Create stock movement record for audit trail
    await db.insert(stockMovementsTable)
      .values({
        product_id: input.product_id,
        movement_type: 'adjustment',
        quantity: input.adjustment_quantity,
        reference_type: 'adjustment',
        reference_id: null,
        notes: input.notes
      })
      .execute();

    // Convert numeric fields back to numbers before returning
    const updatedProduct = updatedProducts[0];
    return {
      ...updatedProduct,
      price: parseFloat(updatedProduct.price)
    };
  } catch (error) {
    console.error('Stock adjustment failed:', error);
    throw error;
  }
}