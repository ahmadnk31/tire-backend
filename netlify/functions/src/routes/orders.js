"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.get('/debug/auth', auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        console.log('Debug auth - User:', user);
        console.log('Debug auth - Headers:', req.headers.authorization);
        res.json({
            user,
            message: 'Authentication successful',
            headers: req.headers.authorization
        });
    }
    catch (error) {
        console.error('Debug auth error:', error);
        res.status(500).json({ error: 'Debug auth failed' });
    }
});
router.get('/debug/admin', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const user = req.user;
        console.log('Debug admin - User:', user);
        res.json({
            user,
            message: 'Admin authentication successful'
        });
    }
    catch (error) {
        console.error('Debug admin error:', error);
        res.status(500).json({ error: 'Debug admin failed' });
    }
});
router.get('/', auth_1.requireAuth, validation_1.paginationValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const { page = '1', limit = '10', status, paymentStatus, userId, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        const requestingUser = req.user;
        if (!requestingUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        const conditions = [];
        if (requestingUser.role !== 'admin') {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.orders.userId, requestingUser.id));
        }
        else if (userId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.orders.userId, parseInt(userId)));
        }
        if (status && status !== 'all') {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.orders.status, status));
        }
        if (paymentStatus && paymentStatus !== 'all') {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.orders.paymentStatus, paymentStatus));
        }
        const orderColumn = sortBy === 'total' ? schema_1.orders.total : schema_1.orders.createdAt;
        const orderDirection = sortOrder === 'asc' ? (0, drizzle_orm_1.asc)(orderColumn) : (0, drizzle_orm_1.desc)(orderColumn);
        const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.sql) `${drizzle_orm_1.sql.join(conditions, (0, drizzle_orm_1.sql) ` AND `)}` : undefined;
        const allOrders = await db_1.db.query.orders.findMany({
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
                items: true
            }
        });
        const totalCountResult = await db_1.db.select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_1.orders)
            .where(whereClause);
        const totalOrders = totalCountResult[0]?.count || 0;
        const totalPages = Math.ceil(totalOrders / limitNum);
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
    }
    catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
router.get('/stats/summary', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const allOrders = await db_1.db.query.orders.findMany();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const todayOrders = allOrders.filter(order => {
            if (!order.createdAt)
                return false;
            const orderDate = new Date(order.createdAt);
            orderDate.setHours(0, 0, 0, 0);
            return orderDate.getTime() === today.getTime();
        });
        const thisMonthOrders = allOrders.filter(order => {
            if (!order.createdAt)
                return false;
            const orderDate = new Date(order.createdAt);
            return orderDate >= thisMonth;
        });
        const totalRevenue = allOrders.reduce((sum, order) => sum + Number(order.total), 0);
        const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total), 0);
        const statusBreakdown = allOrders.reduce((acc, order) => {
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
    }
    catch (error) {
        console.error('Error fetching order stats:', error);
        res.status(500).json({ error: 'Failed to fetch order statistics' });
    }
});
router.get('/:id', auth_1.requireAuth, validation_1.idParamValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const requestingUser = req.user;
        if (!requestingUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const order = await db_1.db.query.orders.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.orders.id, orderId),
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
        if (requestingUser.role !== 'admin' && order.userId !== requestingUser.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json({ order });
    }
    catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});
router.put('/:id', auth_1.requireAuth, auth_1.requireAdmin, validation_1.idParamValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const updates = req.body;
        const { userId, id, createdAt, ...allowedUpdates } = updates;
        const updatedOrder = await db_1.db.update(schema_1.orders)
            .set({
            ...allowedUpdates,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId))
            .returning();
        if (updatedOrder.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ order: updatedOrder[0] });
    }
    catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});
exports.default = router;
