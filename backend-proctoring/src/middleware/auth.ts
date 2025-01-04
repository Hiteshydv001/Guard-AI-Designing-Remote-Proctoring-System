import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../utils/errorResponse';
import { verifyToken } from '../config/jwt';

interface JwtPayload {
  userId: string;
  role: string;
}

const authMiddleware = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      const errorResponse = new ErrorResponse(401, 'No token provided');
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      const errorResponse = new ErrorResponse(401, 'No token provided');
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
      return;
    }

    try {
      const decoded = verifyToken(token) as JwtPayload;

      // Convert roles to lowercase for case-insensitive comparison
      const normalizedRoles = roles.map(role => role.toLowerCase());
      const userRole = decoded.role.toLowerCase();

      if (!normalizedRoles.includes(userRole)) {
        const errorResponse = new ErrorResponse(403, 'Forbidden: You do not have the required permissions');
        res.status(errorResponse.statusCode).json({ message: errorResponse.message });
        return;
      }

      req.user = { userId: decoded.userId, role: decoded.role };
      next();
    } catch (error) {
      const errorResponse = new ErrorResponse(401, 'Invalid or expired token');
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  };
};

export { authMiddleware, JwtPayload };