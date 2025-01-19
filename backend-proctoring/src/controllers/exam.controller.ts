import { Request, Response } from 'express';
import { ExamService } from '../modules/exams/exam.service';
import { ErrorResponse } from '../utils/errorResponse';

class ExamController {
  static async getExams(req: Request, res: Response): Promise<void> {
    try {
      const { organisationId } = req.body;
      const exams = await ExamService.getAllExams(organisationId);
      res.status(200).json(exams);
    } catch (error) {
      const errorResponse = ErrorResponse.handle(error);
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  }

  static async getExamById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const exam = await ExamService.getExamById(id);
      if (!exam) {
        const errorResponse = new ErrorResponse(404, 'Exam not found');
        res.status(errorResponse.statusCode).json({ message: errorResponse.message });
      } else {
        res.status(200).json(exam);
      }
    } catch (error) {
      const errorResponse = ErrorResponse.handle(error);
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  }

  static async createExam(req: Request, res: Response): Promise<void> {
    const { title, duration, organisationId } = req.body;
    try {
      const newExam = await ExamService.createExam(title, duration, organisationId);
      res.status(201).json(newExam);
    } catch (error) {
      const errorResponse = ErrorResponse.handle(error);
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  }

  static async updateExam(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { title, duration } = req.body;
    try {
      const updatedExam = await ExamService.updateExam(id, title, duration);
      res.status(200).json(updatedExam);
    } catch (error) {
      const errorResponse = ErrorResponse.handle(error);
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  }

  static async deleteExam(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      await ExamService.deleteExam(id);
      res.status(204).send();
    } catch (error) {
      const errorResponse = ErrorResponse.handle(error);
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  }
}

export { ExamController };
