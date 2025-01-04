import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Get all users
router.get('/', authMiddleware(['admin']), UserController.getUsers);

// Get user details by ID
router.get('/:id', authMiddleware(['admin', 'user']), UserController.getUserById);

// Update an existing user
router.put('/:id', authMiddleware(['admin','user']), UserController.updateUser);

// Delete a user
router.delete('/:id', authMiddleware(['admin','user']), UserController.deleteUser);

export default router;