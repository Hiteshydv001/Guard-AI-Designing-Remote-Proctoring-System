import { PrismaClient } from '@prisma/client';
import { ErrorResponse } from '../../utils/errorResponse';
import { hashPasswordCrypto, comparePasswordCrypto } from '../../utils/passwordHash';
import { userRole, UserRole } from '../../constants/user.constants';

const prisma = new PrismaClient();

class AuthService {
  static async createUser(name: string, email: string, password: string, role: string, organisationId: string) {
    try {
      if (!UserRole.safeParse(role).success) {
        throw new ErrorResponse(400, 'Invalid role provided');
      }

      const { salt, hash } = hashPasswordCrypto(password);

      return await prisma.user.create({
        data: {
          name,
          email,
          password: hash,
          salt,
          role: role as userRole,
          organisation: {
            connect: { id: organisationId },
          },
        },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error);
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
      throw ErrorResponse.handle(error);
    }
  }
}

export { AuthService };