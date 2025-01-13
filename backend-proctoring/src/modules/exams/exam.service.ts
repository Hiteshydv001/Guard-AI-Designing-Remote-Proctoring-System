import { PrismaClient } from '@prisma/client';
import { ErrorResponse } from '../../utils/errorResponse'; // Import ErrorResponse
const prisma = new PrismaClient();

class ExamService {
  static async getAllExams(organisationId: string) {
    try {
      return await prisma.exam.findMany(
        {
          where: { organisationId },
        }
      );
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Handle error using ErrorResponse
    }
  }

  static async getExamById(id: string) {
    try {
      return await prisma.exam.findUnique({
        where: { id },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Handle error using ErrorResponse
    }
  }

  static async createExam(title: string, duration: number, organisationId: string) {
    try {
      return await prisma.exam.create({
        data: {
          title, 
          duration, 
          organisation: {
            connect: { id: organisationId }, // Link user to organisation
          },
        },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Handle error using ErrorResponse
    }
  }

  static async updateExam(id: string, title: string, duration: number) {
    try {
      return await prisma.exam.update({
        where: { id },
        data: { title, duration },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Handle error using ErrorResponse
    }
  }

  static async deleteExam(id: string) {
    try {
      await prisma.exam.delete({
        where: { id },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Handle error using ErrorResponse
    }
  }
}

export { ExamService };
