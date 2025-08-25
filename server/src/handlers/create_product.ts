import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput, type Product } from '../schema';
import { eq } from 'drizzle-orm';

export const createProduct = async (input: CreateProductInput): Promise<Product> => {
  try {
    // Validate barcode uniqueness if provided
    if (input.barcode) {
      const existingProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.barcode, input.barcode))
        .limit(1)
        .execute();

      if (existingProduct.length > 0) {
        throw new Error(`Product with barcode '${input.barcode}' already exists`);
      }
    }

    // Insert product record
    const result = await db.insert(productsTable)
      .values({
        name: input.name,
        description: input.description,
        barcode: input.barcode,
        price: input.price.toString(), // Convert number to string for numeric column
        stock_quantity: input.stock_quantity,
        category: input.category,
        is_active: input.is_active // Default value handled by Zod
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Product creation failed:', error);
    throw error;
  }
};