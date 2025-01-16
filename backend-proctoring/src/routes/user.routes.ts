import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// Configure rate limiter: maximum of 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Apply rate limiter to all routes
router.use(limiter);

// Get all users
router.get('/', authMiddleware(['admin']), UserController.getUsers);

// Get user details by ID
router.get('/:id', authMiddleware(['admin', 'user']), UserController.getUserById);

// Update an existing user
router.put('/:id', authMiddleware(['admin','user']), UserController.updateUser);

// Delete a user
router.delete('/:id', authMiddleware(['admin','user']), UserController.deleteUser);

export default router;