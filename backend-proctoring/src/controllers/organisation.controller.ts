import { Request, Response } from 'express';
import { ErrorResponse } from '../utils/errorResponse';
import { OrganisationService } from '../modules/organisation/organisation.service';

class OrgainsationController{
    static async getOrganisations(req: Request, res: Response): Promise<void> {
        try {
            const organisations = await OrganisationService.getAllOrganisations();
            res.status(200).json(organisations);
        } catch (error) {
            const errorResponse = ErrorResponse.handle(error);
            res.status(errorResponse.statusCode).json({ message: errorResponse.message });
        }
    }

    static async getOrganisationById(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        try {
            const organisation = await OrganisationService.getOrganisationById(id);
            if (!organisation) {
                const errorResponse = new ErrorResponse(404, 'Organisation not found');
                res.status(errorResponse.statusCode).json({ message: errorResponse.message });
            } else {
                res.status(200).json(organisation);
            }
        } catch (error) {
            const errorResponse = ErrorResponse.handle(error);
            res.status(errorResponse.statusCode).json({ message: errorResponse.message });
        }
    }

    static async createOrganisation(req: Request, res: Response): Promise<void> {
        const { name } = req.body;
        try {
            const newOrganisation = await OrganisationService.createOrganisation(name);
            res.status(201).json(newOrganisation);
        } catch (error) {
            const errorResponse = ErrorResponse.handle(error);
            res.status(errorResponse.statusCode).json({ message: errorResponse.message });
        }
    }

    static async updateOrganisation(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const { name } = req.body;
        try {
            const updatedOrganisation = await OrganisationService.updateOrganisation(id, name);
            res.status(200).json(updatedOrganisation);
        } catch (error) {
            const errorResponse = ErrorResponse.handle(error);
            res.status(errorResponse.statusCode).json({ message: errorResponse.message });
        }
    }

    static async deleteOrganisation(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        try {
            await OrganisationService.deleteOrganisation(id);
            res.status(204).send();
        } catch (error) {
            const errorResponse = ErrorResponse.handle(error);
            res.status(errorResponse.statusCode).json({ message: errorResponse.message });
        }
    }
}

export { OrgainsationController };