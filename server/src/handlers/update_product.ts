import { db } from '../db';
import { productsTable } from '../db/schema';
import { type UpdateProductInput, type Product } from '../schema';
import { eq, and, ne } from 'drizzle-orm';

export const updateProduct = async (input: UpdateProductInput): Promise<Product> => {
  try {
    // First, verify the product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error(`Product with id ${input.id} not found`);
    }

    // If barcode is being updated, check for uniqueness
    if (input.barcode !== undefined && input.barcode !== null) {
      const barcodeExists = await db.select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.barcode, input.barcode),
            ne(productsTable.id, input.id)
          )
        )
        .execute();

      if (barcodeExists.length > 0) {
        throw new Error(`Product with barcode '${input.barcode}' already exists`);
      }
    }

    // Prepare update data, converting numeric fields to strings
    const updateData: Partial<typeof productsTable.$inferInsert> = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.barcode !== undefined) updateData.barcode = input.barcode;
    if (input.price !== undefined) updateData.price = input.price.toString();
    if (input.stock_quantity !== undefined) updateData.stock_quantity = input.stock_quantity;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    // Update the product
    const result = await db.update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const updatedProduct = result[0];
    return {
      ...updatedProduct,
      price: parseFloat(updatedProduct.price)
    };
  } catch (error) {
    console.error('Product update failed:', error);
    throw error;
  }
};