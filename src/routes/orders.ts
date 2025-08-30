import { Router, Request, Response } from 'express';
import { db } from '../db';
import { orders } from '../db/schema';
import { eq, gte, sql, desc, asc } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { 
  idParamValidation, 
  paginationValidation, 
  handleValidationErrors 
} from '../middleware/validation';

const router = Router();

// Debug route to check authentication
router.get('/debug/auth', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    console.log('Debug auth - User:', user);
    console.log('Debug auth - Headers:', req.headers.authorization);
    res.json({ 
      user,
      message: 'Authentication successful',
      headers: req.headers.authorization 
    });
  } catch (error) {
    console.error('Debug auth error:', error);
    res.status(500).json({ error: 'Debug auth failed' });
  }
});

// Debug route to check admin privileges  
router.get('/debug/admin', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    console.log('Debug admin - User:', user);
    res.json({ 
      user,
      message: 'Admin authentication successful' 
    });
  } catch (error) {
    console.error('Debug admin error:', error);
    res.status(500).json({ error: 'Debug admin failed' });
  }
});

interface OrderFilters {
  page?: string;
  limit?: string;
  status?: string;
  paymentStatus?: string;
  userId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// GET /api/orders - Get all orders (admin) or user's orders
router.get('/', requireAuth, paginationValidation, handleValidationErrors, async (req: Request<{}, {}, {}, OrderFilters>, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '10', 
      status,
      paymentStatus,
      userId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query as OrderFilters;

    const requestingUser = (req as any).user;
    if (!requestingUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log('🔍 [Orders API] Requesting user:', {
      id: requestingUser.id,
      email: requestingUser.email,
      role: requestingUser.role
    });
    
    console.log('🔍 [Orders API] Query parameters:', {
      page,
      limit,
      status,
      paymentStatus,
      userId,
      search,
      sortBy,
      sortOrder
    });
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build conditions array
    const conditions: any[] = [];

    // If not admin, only show user's own orders
    if (requestingUser.role !== 'admin') {
      conditions.push(eq(orders.userId, requestingUser.id));
      console.log('🔍 [Orders API] Filtering by user ID:', requestingUser.id);
    } else if (userId) {
      // Admin can filter by specific user
      conditions.push(eq(orders.userId, parseInt(userId)));
      console.log('🔍 [Orders API] Admin filtering by specific user ID:', userId);
    } else {
      console.log('🔍 [Orders API] Admin viewing all orders');
    }

    if (status && status !== 'all') {
      conditions.push(eq(orders.status, status));
    }

    if (paymentStatus && paymentStatus !== 'all') {
      conditions.push(eq(orders.paymentStatus, paymentStatus));
    }

    // Build order clause
    const orderColumn = sortBy === 'total' ? orders.total : orders.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    // Get orders with conditions
    const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;
    
    console.log('🔍 [Orders API] Final conditions:', conditions);
    console.log('🔍 [Orders API] Where clause:', whereClause);
    
    const allOrders = await db.query.orders.findMany({
      where: whereClause,
      orderBy: orderDirection,
      limit: limitNum,
      offset: offset,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true
          }
        },
        items: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                slug: true,
                brand: true,
                model: true,
                size: true,
                price: true
              }
            }
          }
        }
      }
    });

    // Get total count for pagination
    const totalCountResult = await db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause);
    
    const totalOrders = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalOrders / limitNum);

    console.log('🔍 [Orders API] Results:', {
      ordersCount: allOrders.length,
      totalOrders,
      totalPages,
      userRole: requestingUser.role,
      userId: requestingUser.id
    });

    res.json({
      orders: allOrders,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalOrders,
        ordersPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/stats/summary - Get order statistics (admin only)
router.get('/stats/summary', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get all orders
    const allOrders = await db.query.orders.findMany();
    
    // Calculate today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Today's orders
    const todayOrders = allOrders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });

    // This month's orders
    const thisMonthOrders = allOrders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= thisMonth;
    });

    // Calculate totals
    const totalRevenue = allOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total), 0);

    // Status breakdown
    const statusBreakdown = allOrders.reduce((acc: any, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalOrders: allOrders.length,
      todayOrders: todayOrders.length,
      thisMonthOrders: thisMonthOrders.length,
      totalRevenue,
      todayRevenue,
      avgOrderValue: allOrders.length > 0 ? totalRevenue / allOrders.length : 0,
      statusBreakdown,
      pendingOrders: statusBreakdown.pending || 0,
      completedOrders: statusBreakdown.completed || 0,
      cancelledOrders: statusBreakdown.cancelled || 0
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({ error: 'Failed to fetch order statistics' });
  }
});

// GET /api/orders/:id - Get single order
router.get('/:id', requireAuth, idParamValidation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const requestingUser = (req as any).user;
    
    if (!requestingUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user is admin or owns the order
    if (requestingUser.role !== 'admin' && order.userId !== requestingUser.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PUT /api/orders/:id - Update order (admin only for now)
router.put('/:id', requireAuth, requireAdmin, idParamValidation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    const { userId, id, createdAt, ...allowedUpdates } = updates;

    const updatedOrder = await db.update(orders)
      .set({
        ...allowedUpdates,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (updatedOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: updatedOrder[0] });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

export default router;
