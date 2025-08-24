"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.optionalAuth = optionalAuth;
exports.requireRole = requireRole;
exports.requireOwnerOrAdmin = requireOwnerOrAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) {
        return res.status(401).json({
            error: 'Access denied',
            message: 'No token provided'
        });
    }
    try {
        const token = Array.isArray(authHeader) ? authHeader[0].split(' ')[1] : authHeader.split(' ')[1];
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (typeof payload === 'object' && payload && 'id' in payload) {
            req.user = payload;
            next();
        }
        else {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Token payload is invalid'
            });
        }
    }
    catch (error) {
        return res.status(401).json({
            error: 'Invalid token',
            message: 'Token is invalid or expired'
        });
    }
}
async function requireAdmin(req, res, next) {
    console.log('🔒 Admin check:', {
        hasUser: !!req.user,
        userRole: req.user?.role,
        userId: req.user?.id,
        userEmail: req.user?.email
    });
    if (!req.user) {
        console.log('❌ No user found in request');
        return res.status(403).json({
            error: 'Forbidden: Admins only',
            message: 'No user found in request'
        });
    }
    try {
        const userId = req.user.id;
        const user = await db_1.db.select({ role: schema_1.users.role, email: schema_1.users.email })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .limit(1);
        if (!user || user.length === 0) {
            console.log('❌ User not found in database:', userId);
            return res.status(403).json({
                error: 'Forbidden: Admins only',
                message: 'User not found in database'
            });
        }
        const dbRole = user[0].role;
        console.log('🔍 Database role verification:', {
            tokenRole: req.user.role,
            dbRole,
            userId
        });
        if (dbRole !== 'admin') {
            console.log('❌ Database role mismatch:', { expected: 'admin', actual: dbRole });
            return res.status(403).json({
                error: 'Forbidden: Admins only',
                message: `You do not have administrator privileges. Current role: ${dbRole || 'none'}`
            });
        }
        req.user.role = dbRole;
        req.user.email = user[0].email;
        console.log('✅ Admin access granted with database verification');
        next();
    }
    catch (error) {
        console.error('❌ Database verification error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to verify user permissions'
        });
    }
}
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader) {
        try {
            const token = Array.isArray(authHeader) ? authHeader[0].split(' ')[1] : authHeader.split(' ')[1];
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            if (typeof payload === 'object' && payload && 'id' in payload) {
                req.user = payload;
            }
        }
        catch (error) {
            req.user = undefined;
        }
    }
    next();
}
function requireRole(roles) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'You must be logged in to access this resource'
            });
        }
        try {
            const userId = req.user.id;
            const user = await db_1.db.select({ role: schema_1.users.role })
                .from(schema_1.users)
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
                .limit(1);
            if (!user || user.length === 0) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'User not found in database'
                });
            }
            const dbRole = user[0].role;
            if (!roles.includes(dbRole || 'user')) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    message: `You do not have permission to access this resource. Required roles: ${roles.join(', ')}. Your role: ${dbRole || 'none'}`
                });
            }
            req.user.role = dbRole;
            next();
        }
        catch (error) {
            console.error('❌ Database verification error:', error);
            return res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to verify user permissions'
            });
        }
    };
}
function requireOwnerOrAdmin(userIdParam = 'id') {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'You must be logged in to access this resource'
            });
        }
        try {
            const userId = req.user.id;
            const user = await db_1.db.select({ role: schema_1.users.role })
                .from(schema_1.users)
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
                .limit(1);
            if (!user || user.length === 0) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'User not found in database'
                });
            }
            const resourceUserId = parseInt(req.params[userIdParam]);
            const isOwner = userId === resourceUserId;
            const isAdmin = ['admin', 'superadmin'].includes(user[0].role || '');
            req.user.role = user[0].role;
            if (!isOwner && !isAdmin) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You can only access your own resources'
                });
            }
            next();
        }
        catch (error) {
            console.error('❌ Database verification error:', error);
            return res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to verify user permissions'
            });
        }
    };
}
