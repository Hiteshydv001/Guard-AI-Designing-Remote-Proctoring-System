import { PrismaClient } from '@prisma/client';
import { ErrorResponse } from '../../utils/errorResponse'; // Import ErrorResponse class

const prisma = new PrismaClient();

class OrganisationService {
    static async createOrganisation(name: string,) {
        try {
            return await prisma.organisation.create({
                data: {
                    name,
                },
            });
        } catch (error: any) {
            throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
        }
    }

    static async getOrganisationById(id: string) {
        try {
            return await prisma.organisation.findUnique({
                where: { id },
            });
        } catch (error: any) {
            throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
        }
    }

    static async getAllOrganisations() {
        try {
            return await prisma.organisation.findMany();
        } catch (error: any) {
            throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
        }
    }

    static async updateOrganisation(id: string, name: string) {
        try {
            return await prisma.organisation.update({
                where: { id },
                data: { name },
            });
        } catch (error: any) {
            throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
        }
    }

    static async deleteOrganisation(id: string) {
        try {
            await prisma.organisation.delete({
                where: { id },
            });
        } catch (error: any) {
            throw ErrorResponse.handle(error); // Use ErrorResponse for handling errors
        }
    }
}
export { OrganisationService };