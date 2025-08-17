import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role?: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Access denied', 
      message: 'No token provided' 
    });
  }
  
  try {
    const token = Array.isArray(authHeader) ? authHeader[0].split(' ')[1] : authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    if (typeof payload === 'object' && payload && 'id' in payload) {
      (req as any).user = payload;
      next();
    } else {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token payload is invalid'
      });
    }
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid token',
      message: 'Token is invalid or expired'
    });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user || (req as any).user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Forbidden: Admins only',
      message: 'You do not have administrator privileges'
    });
  }
  next();
}

// Optional authentication (doesn't fail if no token)
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  
  if (authHeader) {
    try {
      const token = Array.isArray(authHeader) ? authHeader[0].split(' ')[1] : authHeader.split(' ')[1];
      const payload = jwt.verify(token, process.env.JWT_SECRET!);
      if (typeof payload === 'object' && payload && 'id' in payload) {
        (req as any).user = payload;
      }
    } catch (error) {
      // Token is invalid, but we continue without user
      (req as any).user = undefined;
    }
  }
  next();
}

// Role-based authorization
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    if (!roles.includes((req as any).user.role || 'user')) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  };
}

// Owner or admin access (for user-specific resources)
export function requireOwnerOrAdmin(userIdParam: string = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    const resourceUserId = parseInt(req.params[userIdParam]);
    const isOwner = (req as any).user.id === resourceUserId;
    const isAdmin = ['admin', 'superadmin'].includes((req as any).user.role || '');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
}
