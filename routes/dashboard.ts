import express, { Request, Response } from 'express';
import { eq, lt, desc } from 'drizzle-orm';
import { db } from '../src/db';
import { products, orders } from '../src/db/schema';

const router = express.Router();

interface DashboardStats {
  totalRevenue: number;
  revenueChange: number;
  ordersToday: number;
  ordersChange: number;
  totalCustomers: number;
  customersChange: number;
  productsInStock: number;
  stockChange: number;
  lowStockItems: any[];
  recentOrders: any[];
  salesData: {
    daily: any[];
    monthly: any[];
  };
  topProducts: any[];
  alerts: any[];
}

// Get dashboard statistics
const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    // Get products data
    const allProducts = await db.select().from(products);
    const lowStockProducts = await db
      .select()
      .from(products)
      .where(lt(products.stock, products.lowStockThreshold));

    // Get orders data
    const allOrders = await db.select().from(orders);
    const recentOrdersData = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(4);

    // Calculate metrics
    const totalRevenue = allOrders.reduce((sum, order) => sum + parseFloat(order.total as string), 0);
    const totalProducts = allProducts.length;
    const totalStock = allProducts.reduce((sum, product) => sum + product.stock, 0);

    // Mock data for demonstration - in production, these would be calculated from historical data
    const stats: DashboardStats = {
      totalRevenue,
      revenueChange: 12.5,
      ordersToday: allOrders.filter(order => {
        const today = new Date();
        const orderDate = new Date(order.createdAt || new Date());
        return orderDate.toDateString() === today.toDateString();
      }).length,
      ordersChange: 8.2,
      totalCustomers: 2341,
      customersChange: 5.1,
      productsInStock: totalStock,
      stockChange: -2.3,
      lowStockItems: lowStockProducts.map(product => ({
        id: product.id,
        name: `${product.brand} ${product.model} - ${product.size}`,
        stock: product.stock,
        threshold: product.lowStockThreshold || 10,
        severity: product.stock <= (product.lowStockThreshold || 10) / 2 ? "critical" : "warning"
      })),
      recentOrders: recentOrdersData.map(order => ({
        id: `#${order.orderNumber}`,
        customer: order.userName,
        product: "Tire Product", // Would be joined from order items
        status: order.status,
        amount: `$${parseFloat(order.total as string).toFixed(2)}`,
        date: order.createdAt
      })),
      salesData: {
        daily: [
          { date: '2024-01-15', sales: 4200, orders: 12 },
          { date: '2024-01-16', sales: 3800, orders: 10 },
          { date: '2024-01-17', sales: 5600, orders: 16 },
          { date: '2024-01-18', sales: 4900, orders: 14 },
          { date: '2024-01-19', sales: 6200, orders: 18 },
          { date: '2024-01-20', sales: 5400, orders: 15 },
          { date: '2024-01-21', sales: 7100, orders: 21 }
        ],
        monthly: [
          { month: 'Oct', sales: 82000, orders: 245 },
          { month: 'Nov', sales: 91000, orders: 289 },
          { month: 'Dec', sales: 105000, orders: 324 },
          { month: 'Jan', sales: 118000, orders: 356 }
        ]
      },
      topProducts: allProducts
        .sort((a, b) => (parseFloat(b.price as string) * b.stock) - (parseFloat(a.price as string) * a.stock))
        .slice(0, 3)
        .map(product => ({
          id: product.id,
          name: `${product.brand} ${product.model}`,
          size: product.size,
          unitsSold: Math.floor(Math.random() * 200) + 50, // Mock data
          revenue: parseFloat(product.price as string) * (Math.floor(Math.random() * 200) + 50)
        })),
      alerts: [
        {
          type: "stock",
          message: `${lowStockProducts.length} products are critically low on stock`,
          severity: lowStockProducts.length > 5 ? "high" : "medium",
          timestamp: new Date().toISOString()
        },
        {
          type: "order",
          message: `${allOrders.filter(o => o.status === 'pending').length} new orders require processing`,
          severity: "medium",
          timestamp: new Date().toISOString()
        },
        {
          type: "system",
          message: "Inventory sync completed successfully",
          severity: "low",
          timestamp: new Date().toISOString()
        }
      ]
    };

    return stats;
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw error;
  }
};

// GET /api/dashboard/overview - Get dashboard overview stats
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const stats = await getDashboardStats();
    
    const overview = {
      revenue: {
        total: stats.totalRevenue,
        change: stats.revenueChange,
        trend: stats.revenueChange > 0 ? 'up' : 'down'
      },
      orders: {
        today: stats.ordersToday,
        change: stats.ordersChange,
        trend: stats.ordersChange > 0 ? 'up' : 'down'
      },
      customers: {
        total: stats.totalCustomers,
        change: stats.customersChange,
        trend: stats.customersChange > 0 ? 'up' : 'down'
      },
      products: {
        inStock: stats.productsInStock,
        change: stats.stockChange,
        trend: stats.stockChange > 0 ? 'up' : 'down'
      }
    };

    res.json(overview);
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

// GET /api/dashboard/recent-orders - Get recent orders
router.get('/recent-orders', async (req: Request, res: Response) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats.recentOrders);
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});

// GET /api/dashboard/low-stock - Get low stock items
router.get('/low-stock', async (req: Request, res: Response) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats.lowStockItems);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

// GET /api/dashboard/sales-data - Get sales analytics data
router.get('/sales-data', async (req: Request, res: Response) => {
  try {
    const { period = 'daily' } = req.query;
    const stats = await getDashboardStats();
    
    const salesData = period === 'monthly' ? stats.salesData.monthly : stats.salesData.daily;
    
    res.json({
      period,
      data: salesData,
      summary: {
        totalSales: salesData.reduce((sum, item) => sum + item.sales, 0),
        totalOrders: salesData.reduce((sum, item) => sum + item.orders, 0),
        averageOrderValue: salesData.reduce((sum, item) => sum + item.sales, 0) / 
                          salesData.reduce((sum, item) => sum + item.orders, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// GET /api/dashboard/top-products - Get top performing products
router.get('/top-products', async (req: Request, res: Response) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats.topProducts);
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

// GET /api/dashboard/alerts - Get system alerts
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats.alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/dashboard/analytics - Get comprehensive analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const stats = await getDashboardStats();
    
    res.json({
      overview: {
        revenue: {
          total: stats.totalRevenue,
          change: stats.revenueChange,
          trend: stats.revenueChange > 0 ? 'up' : 'down'
        },
        orders: {
          today: stats.ordersToday,
          change: stats.ordersChange,
          trend: stats.ordersChange > 0 ? 'up' : 'down'
        },
        customers: {
          total: stats.totalCustomers,
          change: stats.customersChange,
          trend: stats.customersChange > 0 ? 'up' : 'down'
        },
        products: {
          inStock: stats.productsInStock,
          change: stats.stockChange,
          trend: stats.stockChange > 0 ? 'up' : 'down'
        }
      },
      recentActivity: stats.recentOrders,
      lowStock: stats.lowStockItems,
      topProducts: stats.topProducts,
      salesTrend: stats.salesData.daily,
      alerts: stats.alerts
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
