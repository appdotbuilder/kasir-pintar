import { db } from '../db';
import { productsTable, transactionsTable, transactionItemsTable, stockMovementsTable } from '../db/schema';
import { type CreateTransactionInput, type TransactionWithItems } from '../schema';
import { eq, SQL } from 'drizzle-orm';

export const createTransaction = async (input: CreateTransactionInput): Promise<TransactionWithItems> => {
  try {
    // Validate input
    if (!input.items || input.items.length === 0) {
      throw new Error('Transaction must contain at least one item');
    }

    // Step 1: Validate products exist and have sufficient stock
    const productIds = input.items.map(item => item.product_id);
    
    // Get all products from database and filter for requested ones
    const allProducts = await db.select()
      .from(productsTable)
      .execute();
    
    const requestedProducts = allProducts.filter(p => productIds.includes(p.id));
    
    if (requestedProducts.length !== productIds.length) {
      throw new Error('One or more products not found');
    }

    // Validate stock availability
    for (const item of input.items) {
      const product = requestedProducts.find(p => p.id === item.product_id);
      if (!product) {
        throw new Error(`Product with ID ${item.product_id} not found`);
      }
      if (!product.is_active) {
        throw new Error(`Product "${product.name}" is not active`);
      }
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for product "${product.name}". Available: ${product.stock_quantity}, Requested: ${item.quantity}`);
      }
    }

    // Step 2: Calculate totals
    let totalAmount = 0;
    const itemDetails = input.items.map(item => {
      const product = requestedProducts.find(p => p.id === item.product_id)!;
      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;
      
      return {
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice
      };
    });

    const changeAmount = Math.max(0, input.payment_amount - totalAmount);
    const transactionNumber = `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Step 3: Create transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_number: transactionNumber,
        total_amount: totalAmount.toString(),
        payment_method: input.payment_method,
        payment_amount: input.payment_amount.toString(),
        change_amount: changeAmount.toString(),
        status: 'completed',
        notes: input.notes
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Step 4: Create transaction items
    const transactionItemsData = itemDetails.map(item => ({
      transaction_id: transaction.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price.toString(),
      total_price: item.total_price.toString()
    }));

    const transactionItemsResult = await db.insert(transactionItemsTable)
      .values(transactionItemsData)
      .returning()
      .execute();

    // Step 5: Update product stock quantities
    for (const item of input.items) {
      const product = requestedProducts.find(p => p.id === item.product_id)!;
      const newStock = product.stock_quantity - item.quantity;
      
      await db.update(productsTable)
        .set({
          stock_quantity: newStock,
          updated_at: new Date()
        })
        .where(eq(productsTable.id, item.product_id))
        .execute();
    }

    // Step 6: Create stock movement records
    const stockMovementsData = input.items.map(item => ({
      product_id: item.product_id,
      movement_type: 'out' as const,
      quantity: -item.quantity, // Negative for stock reduction
      reference_type: 'transaction' as const,
      reference_id: transaction.id,
      notes: `Sale - Transaction ${transactionNumber}`
    }));

    await db.insert(stockMovementsTable)
      .values(stockMovementsData)
      .execute();

    // Step 7: Return transaction with items
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
      items: transactionItemsResult.map(item => ({
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
    console.error('Transaction creation failed:', error);
    throw error;
  }
};