import { Request, Response } from 'express';
import { AuthService } from '../modules/auth/auth.service';
import { ErrorResponse } from '../utils/errorResponse';
import { generateToken } from '../config/jwt';

class AuthController {
  private static handleError(error: any, res: Response): void {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }

  static async register(req: Request, res: Response): Promise<void> {
    const { name, email, password, role, organisationId } = req.body;
    try {
      const newUser = await AuthService.createUser(name, email, password, role, organisationId);
      const token = generateToken({ userId: newUser.id, role: newUser.role });
      res.status(201).json({ user: newUser, token });
    } catch (error) {
      console.log(error);
      this.handleError(error, res);
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    try {
      const user = await AuthService.loginUser(email, password);
      const token = generateToken({ userId: user.id, role: user.role });
      res.status(200).json({ user, token });
    } catch (error) {
      console.log(error);
      this.handleError(error, res);
    }
  }
}

export { AuthController };