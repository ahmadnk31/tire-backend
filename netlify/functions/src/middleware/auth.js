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
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Forbidden: Admins only',
            message: 'You do not have administrator privileges'
        });
    }
    next();
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
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'You must be logged in to access this resource'
            });
        }
        if (!roles.includes(req.user.role || 'user')) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                message: 'You do not have permission to access this resource'
            });
        }
        next();
    };
}
function requireOwnerOrAdmin(userIdParam = 'id') {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'You must be logged in to access this resource'
            });
        }
        const resourceUserId = parseInt(req.params[userIdParam]);
        const isOwner = req.user.id === resourceUserId;
        const isAdmin = ['admin', 'superadmin'].includes(req.user.role || '');
        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only access your own resources'
            });
        }
        next();
    };
}
