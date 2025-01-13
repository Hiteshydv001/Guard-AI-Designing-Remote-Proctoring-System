import { Router } from 'express';
import { ProctorController } from '../controllers/proctor.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Start a proctoring session
router.post('/start', authMiddleware(['admin', 'proctor']), ProctorController.startProctoringSession);

// End a proctoring session
router.put('/end/:sessionId', authMiddleware(['admin', 'proctor']), ProctorController.endProctoringSession);

// Get the status of a proctoring session
router.get('/:sessionId', authMiddleware(['admin', 'proctor']), ProctorController.getSessionStatus);

// Handle tab change event
//router.post('/tab-change', authMiddleware(['admin', 'proctor','user']), ProctorController.handleTabChange);

router.post('/tab-change', ProctorController.handleTabChange);

// Handle heartbeat event
router.post('/heartbeat', authMiddleware(['admin', 'proctor']), ProctorController.handleHeartbeat);

export default router;