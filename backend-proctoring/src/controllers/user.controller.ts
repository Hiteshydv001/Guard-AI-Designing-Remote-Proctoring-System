import { Request, Response } from 'express';
import { UserService } from '../modules/users/user.service';
import { ErrorResponse } from '../utils/errorResponse';

class UserController {
  // Helper function to handle errors
  private static handleError(error: any, res: Response): void {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }
  static async getUsers(req: Request, res: Response): Promise<void> {
    const organisationId = req.body.organisationId;
    try {
      const users = await UserService.getAllUsers(organisationId);
      users.forEach(user => user.password = ''); // Set password to undefined for each user
      res.status(200).json(users);
    } catch (error) {
      this.handleError(error, res);  // Use helper function to handle error
    }
  }
  static async getUserById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const user = await UserService.getUserById(id);

      if (!user) {
        const errorResponse = new ErrorResponse(404, 'User not found');
        res.status(errorResponse.statusCode).json({ message: errorResponse.message });
      } else {
        user.password = ''; // Set password to null
        res.status(200).json(user);
      }
    } catch (error) {
      this.handleError(error, res);  // Use helper function to handle error
    }
  }

  static async createUser(req: Request, res: Response): Promise<void> {
    const { name, email, password, role, organisationId } = req.body;
    try {
      const newUser = await UserService.createUser(name, email, password, role, organisationId);
      res.status(201).json(newUser);
    } catch (error) {
      this.handleError(error, res);  // Use helper function to handle error
    }
  }

  static async loginUser(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    try {
      const user = await UserService.loginUser(email, password);
      res.status(200).json(user);
    } catch (error) {
      this.handleError(error, res);  // Use helper function to handle error
    }
  }

  static async updateUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { name, email } = req.body;
    try {
      const updatedUser = await UserService.updateUser(id, name, email);
      res.status(200).json(updatedUser);
    } catch (error) {
      this.handleError(error, res);  // Use helper function to handle error
    }
  }

  static async deleteUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      await UserService.deleteUser(id);
      res.status(204).send(); // No content
    } catch (error) {
      this.handleError(error, res);  // Use helper function to handle error
    }
  }
}

export { UserController };
