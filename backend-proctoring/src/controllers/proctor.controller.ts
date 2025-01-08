import { Request, Response } from 'express';
import { ProctorService } from '../modules/proctoring/proctor.service';
import { ErrorResponse } from '../utils/errorResponse';


class ProctorController {
  static async startProctoringSession(req: Request, res: Response): Promise<void> {
    const { examId, userId,organisationId } = req.body;
    try {
      const session = await ProctorService.startSession(examId, userId,organisationId);
      res.status(201).json(session);
    } catch (error) {
      const errorResponse = ErrorResponse.handle(error);
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  }
  static async handleTabChange(req: Request, res: Response): Promise<void> {
    const { examId, userId, timestamp } = req.body;
    try {
      await ProctorService.logTabChange(examId, userId, timestamp);
      res.status(200).send();
    } catch (error) {
      console.error('Error handling tab change:', error); // Add logging
      const errorResponse = ErrorResponse.handle(error);
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  }

  static async handleHeartbeat(req: Request, res: Response): Promise<void> {
    const { examId, userId, timestamp } = req.body;
    try {
      await ProctorService.logHeartbeat(examId, userId, timestamp);
      res.status(200).send();
    } catch (error) {
      console.error('Error handling heartbeat:', error); // Add logging
      const errorResponse = ErrorResponse.handle(error);
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  }



  static async endProctoringSession(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    try {
      await ProctorService.endSession(sessionId);
      res.status(204).send();
    } catch (error) {
      const errorResponse = ErrorResponse.handle(error);
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  }

  static async getSessionStatus(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    try {
      const sessionStatus = await ProctorService.getSessionStatus(sessionId);
      if (!sessionStatus) {
        const errorResponse = new ErrorResponse(404, 'Session not found');
        res.status(errorResponse.statusCode).json({ message: errorResponse.message });
      } else {
        res.status(200).json(sessionStatus);
      }
    } catch (error) {
      const errorResponse = ErrorResponse.handle(error);
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
  }
}

export { ProctorController };
