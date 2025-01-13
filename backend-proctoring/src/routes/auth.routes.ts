import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

// Register a new user
router.post('/register', AuthController.register);

// Login a user
router.post('/login', AuthController.login);

export default router;