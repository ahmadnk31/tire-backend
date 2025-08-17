import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, gte, desc, asc } from 'drizzle-orm';
import { db } from '../src/db';
import { orders } from '../src/db/schema';

const router = express.Router();

interface OrderFilters {
  page?: string;
  limit?: string;
  status?: string;
  paymentStatus?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// GET /api/orders - Get all orders
router.get('/', async (req: Request<{}, {}, {}, OrderFilters>, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '10', 
      status, 
      paymentStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build conditions array
    const conditions: any[] = [];

    if (status && status !== 'all') {
      conditions.push(eq(orders.status, status));
    }

    if (paymentStatus && paymentStatus !== 'all') {
      conditions.push(eq(orders.paymentStatus, paymentStatus));
    }

    // Build where clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order clause - fix the field access
    let orderClause;
    if (sortBy === 'createdAt') {
      orderClause = sortOrder === 'desc' ? desc(orders.createdAt) : asc(orders.createdAt);
    } else if (sortBy === 'total') {
      orderClause = sortOrder === 'desc' ? desc(orders.total) : asc(orders.total);
    } else {
      orderClause = sortOrder === 'desc' ? desc(orders.createdAt) : asc(orders.createdAt);
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const result = await db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limitNum)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: orders.id })
      .from(orders)
      .where(whereClause);
    
    const totalCount = totalResult.length;

    res.json({
      orders: result,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalOrders: totalCount,
        ordersPerPage: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get single order
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, req.params.id))
      .limit(1);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// POST /api/orders - Create new order
router.post('/', async (req: Request, res: Response) => {
  try {
    // Get the current order count to generate order number
    const existingOrders = await db.select({ id: orders.id }).from(orders);
    const orderNumber = `TM-${String(existingOrders.length + 1).padStart(3, '0')}`;
    
    const orderData = {
      id: orderNumber,
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.insert(orders).values(orderData).returning();
    
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PUT /api/orders/:id - Update order
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };

    const result = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.orderNumber, req.params.id))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// GET /api/orders/stats/summary - Get order statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all orders
    const allOrders = await db.select().from(orders);
    
    // Filter by date
    const todayOrders = allOrders.filter(o => new Date(o.createdAt || new Date()) >= today);
    const thisMonthOrders = allOrders.filter(o => new Date(o.createdAt || new Date()) >= thisMonth);
    
    const totalRevenue = allOrders.reduce((sum, order) => sum + parseFloat(order.total as string), 0);
    const todayRevenue = todayOrders.reduce((sum, order) => sum + parseFloat(order.total as string), 0);

    const stats = {
      totalOrders: allOrders.length,
      todayOrders: todayOrders.length,
      thisMonthOrders: thisMonthOrders.length,
      totalRevenue,
      todayRevenue,
      averageOrderValue: allOrders.length > 0 ? totalRevenue / allOrders.length : 0,
      ordersByStatus: {
        pending: allOrders.filter(o => o.status === 'pending').length,
        processing: allOrders.filter(o => o.status === 'processing').length,
        shipped: allOrders.filter(o => o.status === 'shipped').length,
        completed: allOrders.filter(o => o.status === 'completed').length,
        cancelled: allOrders.filter(o => o.status === 'cancelled').length
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({ error: 'Failed to fetch order statistics' });
  }
});

export default router;