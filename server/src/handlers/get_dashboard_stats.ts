import { db } from '../db';
import { productsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type DashboardStats } from '../schema';
import { sql, eq, lt, gte, and, desc } from 'drizzle-orm';

export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    // Get current date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get first day of current month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Get today's sales and transaction count
    const todayStatsQuery = await db
      .select({
        total_sales: sql<string>`COALESCE(SUM(${transactionsTable.total_amount}), 0)`,
        total_transactions: sql<string>`COUNT(*)`
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.status, 'completed'),
          gte(transactionsTable.created_at, today),
          lt(transactionsTable.created_at, tomorrow)
        )
      )
      .execute();

    const todayStats = todayStatsQuery[0];
    const totalSalesToday = parseFloat(todayStats.total_sales);
    const totalTransactionsToday = parseInt(todayStats.total_transactions);

    // Get current month's revenue
    const monthRevenueQuery = await db
      .select({
        total_revenue: sql<string>`COALESCE(SUM(${transactionsTable.total_amount}), 0)`
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.status, 'completed'),
          gte(transactionsTable.created_at, firstDayOfMonth)
        )
      )
      .execute();

    const totalRevenueMonth = parseFloat(monthRevenueQuery[0].total_revenue);

    // Get low stock products count (stock < 10)
    const lowStockQuery = await db
      .select({
        count: sql<string>`COUNT(*)`
      })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.is_active, true),
          lt(productsTable.stock_quantity, 10)
        )
      )
      .execute();

    const lowStockProducts = parseInt(lowStockQuery[0].count);

    // Get top 5 selling products with revenue data
    const topSellingQuery = await db
      .select({
        product_id: transactionItemsTable.product_id,
        product_name: transactionItemsTable.product_name,
        total_sold: sql<string>`SUM(${transactionItemsTable.quantity})`,
        revenue: sql<string>`SUM(${transactionItemsTable.total_price})`
      })
      .from(transactionItemsTable)
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .where(eq(transactionsTable.status, 'completed'))
      .groupBy(transactionItemsTable.product_id, transactionItemsTable.product_name)
      .orderBy(desc(sql`SUM(${transactionItemsTable.quantity})`))
      .limit(5)
      .execute();

    const topSellingProducts = topSellingQuery.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      total_sold: parseInt(item.total_sold),
      revenue: parseFloat(item.revenue)
    }));

    return {
      total_sales_today: totalSalesToday,
      total_transactions_today: totalTransactionsToday,
      low_stock_products: lowStockProducts,
      total_revenue_month: totalRevenueMonth,
      top_selling_products: topSellingProducts
    };
  } catch (error) {
    console.error('Dashboard stats retrieval failed:', error);
    throw error;
  }
};