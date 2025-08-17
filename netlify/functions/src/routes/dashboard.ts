
import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { db } from '../db';
import { orders, orderItems, products as productsTable, users as usersTable } from '../db/schema';
import { desc, eq, inArray } from 'drizzle-orm';

const router = Router();

// Recent orders (real data)
router.get('/recent-orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get 10 most recent orders
    const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(10);
    // For each order, get first order item and join product and user
    const orderIds = recentOrders.map(o => o.id);
    let itemsByOrderId: Record<number, any> = {};
    if (orderIds.length > 0) {
      const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));
      itemsByOrderId = items.reduce((acc: any, item: any) => {
        if (!acc[item.orderId]) acc[item.orderId] = [];
        acc[item.orderId].push(item);
        return acc;
      }, {});
    }
    const result = await Promise.all(recentOrders.map(async (order) => {
      const firstItem = (itemsByOrderId[order.id] && itemsByOrderId[order.id][0]) || null;
      let productName = '';
      if (firstItem) {
        const prod = await db.select().from(productsTable).where(eq(productsTable.id, firstItem.productId));
        productName = prod[0]?.name || '';
      }
      return {
        id: order.orderNumber,
        customer: order.userName,
        product: productName,
        status: order.status,
        amount: `$${order.total}`,
        date: order.createdAt?.toISOString().slice(0, 10) || '',
      };
    }));
    res.json(result);
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});




// Only allow admin users
router.get('/', requireAuth, requireAdmin, (req, res) => {
  res.json({ message: 'Admin dashboard root.' });
});

// Dashboard overview (real data)
router.get('/overview', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Total users
    const usersCount = await db.select().from(usersTable);
    // Total orders
    const ordersCount = await db.select().from(orders);
    // Total revenue
    const revenueResult = await db.select().from(orders);
    const totalRevenue = revenueResult.reduce((sum, o) => sum + parseFloat(o.total), 0);
    // New users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsers = usersCount.filter(u => u.createdAt && u.createdAt > sevenDaysAgo).length;
    // New orders (last 7 days)
    const newOrders = ordersCount.filter(o => o.createdAt && o.createdAt > sevenDaysAgo).length;
    // New revenue (last 7 days)
    const newRevenue = ordersCount.filter(o => o.createdAt && o.createdAt > sevenDaysAgo).reduce((sum, o) => sum + parseFloat(o.total), 0);
    // Best selling products (by orderItems quantity)
    const orderItemRows = await db.select().from(orderItems);
    const productSales: Record<number, number> = {};
    orderItemRows.forEach(item => {
      if (item.productId == null) return;
      if (!productSales[item.productId]) productSales[item.productId] = 0;
      productSales[item.productId] += item.quantity;
    });
    const bestSellingIds = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, sold]) => ({ id: Number(id), sold }));
    let bestSellingProducts: any[] = [];
    if (bestSellingIds.length > 0) {
      const prods = await db.select().from(productsTable).where(inArray(productsTable.id, bestSellingIds.map(p => p.id)));
      bestSellingProducts = bestSellingIds.map(({ id, sold }) => {
        const prod = prods.find((p: any) => p.id === id);
        return prod ? { id, name: prod.name, sold } : null;
      }).filter(Boolean);
    }
    res.json({
      totalUsers: usersCount.length,
      totalOrders: ordersCount.length,
      totalRevenue,
      newUsers,
      newOrders,
      newRevenue,
      bestSellingProducts
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

// Low stock products (real data)
router.get('/low-stock', requireAuth, requireAdmin, async (req, res) => {
  try {
    const lowStockProducts = await db.select().from(productsTable);
    const lowStock = lowStockProducts.filter(p => p.stock <= (p.lowStockThreshold || 10));
    res.json({
      products: lowStock.map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        threshold: p.lowStockThreshold || 10,
        severity: p.stock <= 2 ? 'critical' : 'low',
      }))
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

// ...existing real recent-orders endpoint above...

export default router;
