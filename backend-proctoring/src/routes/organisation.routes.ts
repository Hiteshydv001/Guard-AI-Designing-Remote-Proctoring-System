import { Router, Request, Response } from 'express';
import { OrganisationService } from '../modules/organisation/organisation.service';
import { ErrorResponse } from '../utils/errorResponse';

const router = Router();

// Get all organisations
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const organisations = await OrganisationService.getAllOrganisations();
    res.status(200).json(organisations);
  } catch (error: any) {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }
});

// Get organisation by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const organisation = await OrganisationService.getOrganisationById(req.params.id);
    if (!organisation) {
      const errorResponse = new ErrorResponse(404, 'Organisation not found');
      res.status(errorResponse.statusCode).json({ message: errorResponse.message });
      return;
    }
    res.status(200).json(organisation);
  } catch (error: any) {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }
});

// Create a new organisation
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const organisation = await OrganisationService.createOrganisation(name);
    res.status(201).json(organisation);
  } catch (error: any) {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }
});

// Update an existing organisation
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const organisation = await OrganisationService.updateOrganisation(req.params.id, name);
    res.status(200).json(organisation);
  } catch (error: any) {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }
});

// Delete an organisation
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await OrganisationService.deleteOrganisation(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    const errorResponse = ErrorResponse.handle(error);
    res.status(errorResponse.statusCode).json({ message: errorResponse.message });
  }
});

export default router;