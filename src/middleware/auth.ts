import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

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

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  console.log('🔒 Admin check:', {
    hasUser: !!(req as any).user,
    userRole: (req as any).user?.role,
    userId: (req as any).user?.id,
    userEmail: (req as any).user?.email
  });

  if (!(req as any).user) {
    console.log('❌ No user found in request');
    return res.status(403).json({ 
      error: 'Forbidden: Admins only',
      message: 'No user found in request'
    });
  }

  try {
    // Verify user role from database to prevent token tampering
    const userId = (req as any).user.id;
    const user = await db.select({ role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
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
      tokenRole: (req as any).user.role, 
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

    // Update the request user object with verified database data
    (req as any).user.role = dbRole;
    (req as any).user.email = user[0].email;

    console.log('✅ Admin access granted with database verification');
    next();
  } catch (error) {
    console.error('❌ Database verification error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to verify user permissions'
    });
  }
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

// Role-based authorization with database verification
export function requireRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    try {
      // Verify user role from database to prevent token tampering
      const userId = (req as any).user.id;
      const user = await db.select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
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

      // Update the request user object with verified database data
      (req as any).user.role = dbRole;
      next();
    } catch (error) {
      console.error('❌ Database verification error:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to verify user permissions'
      });
    }
  };
}

// Owner or admin access (for user-specific resources) with database verification
export function requireOwnerOrAdmin(userIdParam: string = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    try {
      // Verify user role from database to prevent token tampering
      const userId = (req as any).user.id;
      const user = await db.select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
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

      // Update the request user object with verified database data
      (req as any).user.role = user[0].role;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only access your own resources'
        });
      }

      next();
    } catch (error) {
      console.error('❌ Database verification error:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to verify user permissions'
      });
    }
  };
}
