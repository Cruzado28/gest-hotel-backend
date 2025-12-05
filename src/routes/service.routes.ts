import { Router } from 'express';
import { ServiceController } from '../controllers/service.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const serviceController = new ServiceController();

// Obtener todos los servicios disponibles
router.get('/', (req, res) => serviceController.getServices(req, res));

// Obtener servicios de una reserva (requiere autenticación)
router.get(
  '/reservation/:reservationId',
  authMiddleware,
  (req, res) => serviceController.getReservationServices(req, res)
);

export default router;