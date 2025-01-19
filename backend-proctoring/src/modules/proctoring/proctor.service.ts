import { PrismaClient } from '@prisma/client';
import { ErrorResponse } from '../../utils/errorResponse'; // Import the ErrorResponse class
import { StartSessionSchema } from '../../constants/user.constants';
import { wss } from '../../server'; // Import the WebSocket server
import { WebSocket } from 'ws'; // Import the WebSocket class from 'ws'

const prisma = new PrismaClient();

class ProctorService {
  static async startSession(examId: string, userId: string, organisationId: string) {
    try {
      // Validate input data
      StartSessionSchema.parse({ examId, userId, organisationId });

      return await prisma.proctoringSession.create({
        data: {
          examId,
          userId,
          startTime: new Date(),
          status: 'active',
          organisationId, // Link user to organisation
        },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Handle error using ErrorResponse
    }
  }

  static async endSession(sessionId: string) {
    try {
      // Validate sessionId

      await prisma.proctoringSession.update({
        where: { id: sessionId },
        data: { endTime: new Date(), status: 'completed' },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Handle error using ErrorResponse
    }
  }

  static async getSessionStatus(sessionId: string) {
    try {
      // Validate sessionId

      return await prisma.proctoringSession.findUnique({
        where: { id: sessionId },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error); // Handle error using ErrorResponse
    }
  }

    static async logTabChange(examId: string, userId: string, timestamp: string) {
    try {
      // Get the most recent tab change for this exam/user
      const lastChange = await prisma.tabChangeLog.findFirst({
        where: { examId, userId },
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      });
  
      // Calculate duration
      let differenceInSeconds = 0;
      if (lastChange) {
        const msDiff = new Date(timestamp).getTime() - new Date(lastChange.timestamp).getTime();
        differenceInSeconds = Math.round(msDiff / 1000);
      }
  
      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true
        }
      });
  
      // Insert new tab change log
      await prisma.tabChangeLog.create({
        data: {
          examId,
          userId,
          timestamp: new Date(timestamp),
        },
      });
  
      // Notify proctor with detailed information
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: 'tabChange',
              examId,
              userId,
              userName: user?.name,
              userEmail: user?.email,
              message: `Tab change detected for ${user?.name}`,
              duration: {
                seconds: differenceInSeconds,
                formatted: `${Math.floor(differenceInSeconds / 60)}m ${differenceInSeconds % 60}s`
              },
              timestamp: new Date(timestamp).toISOString()
            }),
          );
        }
      });
  
      return {
        differenceInSeconds,
        user,
        timestamp
      };
    } catch (error: any) {
      throw ErrorResponse.handle(error, 'logTabChange');
    }
  }

  static async logHeartbeat(examId: string, userId: string, timestamp: string) {
    try {
      await prisma.heartbeatLog.create({
        data: {
          examId,
          userId,
          timestamp: new Date(timestamp),
        },
      });
    } catch (error: any) {
      throw ErrorResponse.handle(error,"logHeartbeat");
    }
  }
}


export { ProctorService };