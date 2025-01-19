import { PrismaClient } from '@prisma/client';
import { ErrorResponse } from '../../utils/errorResponse'; // Import ErrorResponse class
import { UpdateUserScheme } from '../../constants/user.constants';
import { hashPasswordCrypto, comparePasswordCrypto } from '../../utils/passwordHash';
import { userRole, UserRole } from '../../constants/user.constants';
const prisma = new PrismaClient();

class UserService {
  static async createUser(name: string, email: string, password: string, role: string, organisationId: string) {
    try {
      // Validate role against UserRole enum
      if (!UserRole.safeParse(role).success) {
        throw new ErrorResponse(400, 'Invalid role provided');
      }

      const { salt, hash } = hashPasswordCrypto(password);

      // Ensure organisationId is passed
      return await prisma.user.create({
        data: {
          name,
          email,
          password: hash,
          salt,
          role: role as userRole,
          organisation: {
            connect: { id: organisationId }, // Link user to organisation
          },
        },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
    }
  }

  static async loginUser(email: string, password: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new ErrorResponse(401, 'Invalid email or password');
      }

      const { salt, password: storedHash } = user;
      const isMatch = comparePasswordCrypto(password, salt, storedHash);

      if (!isMatch) {
        throw new ErrorResponse(401, 'Invalid email or password');
      }

      return user;
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
    }
  }

  static async getAllUsers(organisationId: string) {
    try {
      return await prisma.user.findMany(
        {
          where: { organisationId },
        },
      );
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
    }
  }

  static async getUserById(id: string) {
    try {
      return await prisma.user.findUnique({
        where: { id },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
    }
  }

  static async updateUser(id: string, name: string, email: string) {
    try {
      const success = UpdateUserScheme.parse({ id, name, email });
      if (!success) {
        throw new ErrorResponse(400, 'Invalid input provided');
      }

      return await prisma.user.update({
        where: { id },
        data: { name, email },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
    }
  }

  static async deleteUser(id: string) {
    try {
      await prisma.user.delete({
        where: { id },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
    }
  }
}

export { UserService };
