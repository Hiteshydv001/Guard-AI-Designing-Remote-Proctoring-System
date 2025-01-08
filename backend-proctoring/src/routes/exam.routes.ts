import { Router, Request, Response } from 'express';
import { ExamService } from '../modules/exams/exam.service';
import { ErrorResponse } from '../utils/errorResponse';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Get all exams
router.get('/', authMiddleware(['admin', 'user']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { organisationId } = req.body;
    const exams = await ExamService.getAllExams(organisationId);
    res.status(200).json(exams);
  } catch (error: any) {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }
});

// Get exam by ID
router.get('/:id', authMiddleware(['admin', 'user']), async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = await ExamService.getExamById(req.params.id);
    if (!exam) {
      const errorResponse = new ErrorResponse(404, 'Exam not found');
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
      return;
    }
    res.status(200).json(exam);
  } catch (error: any) {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }
});

// Create a new exam
router.post('/', authMiddleware(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, duration, organisationId } = req.body;
    const exam = await ExamService.createExam(title, duration, organisationId);
    res.status(201).json(exam);
  } catch (error: any) {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }
});

// Update an existing exam
router.put('/:id', authMiddleware(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, duration } = req.body;
    const exam = await ExamService.updateExam(req.params.id, title, duration);
    res.status(200).json(exam);
  } catch (error: any) {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }
});

export default router;