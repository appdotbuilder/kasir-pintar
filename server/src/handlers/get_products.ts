import { db } from '../db';
import { productsTable } from '../db/schema';
import { type Product } from '../schema';
import { eq, ilike, or, and, desc, asc, sql, type SQL } from 'drizzle-orm';

export interface GetProductsFilters {
  search?: string;
  category?: string;
  is_active?: boolean;
  orderBy?: 'name' | 'price' | 'stock_quantity' | 'created_at';
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export const getProducts = async (filters: GetProductsFilters = {}): Promise<Product[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Filter by active status (default to true if not specified)
    const isActive = filters.is_active !== undefined ? filters.is_active : true;
    conditions.push(eq(productsTable.is_active, isActive));

    // Add search filter (searches name, description, and barcode)
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      
      // Use sql template to handle nullable columns properly
      const searchCondition = sql`(
        ${productsTable.name} ILIKE ${searchTerm} OR 
        ${productsTable.description} ILIKE ${searchTerm} OR 
        ${productsTable.barcode} ILIKE ${searchTerm}
      )`;
      
      conditions.push(searchCondition);
    }

    // Add category filter
    if (filters.category) {
      conditions.push(eq(productsTable.category, filters.category));
    }

    // Build the base query with all conditions at once
    const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
    
    // Apply ordering
    const orderBy = filters.orderBy || 'created_at';
    const orderDirection = filters.orderDirection || 'desc';
    const orderClause = orderDirection === 'desc' ? desc(productsTable[orderBy]) : asc(productsTable[orderBy]);

    // Apply pagination
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    // Execute the complete query
    const results = await db.select()
      .from(productsTable)
      .where(whereCondition)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);

    // Convert numeric fields and return
    return results.map(product => ({
      ...product,
      price: parseFloat(product.price) // Convert numeric string to number
    }));
  } catch (error) {
    console.error('Get products failed:', error);
    throw error;
  }
};