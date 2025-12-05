import { Router } from 'express';
import { ReservationController } from '../controllers/reservation.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const reservationController = new ReservationController();

router.use(authMiddleware);

// Rutas específicas primero
router.get('/:id/pdf', (req, res) => reservationController.generateReservationPDF(req, res));
router.get('/:id/discounts', (req, res) => reservationController.getReservationDiscounts(req, res));

// Rutas genéricas después
router.post('/', (req, res) => reservationController.createReservation(req, res));
router.get('/', (req, res) => reservationController.getReservations(req, res));
router.get('/:id', (req, res) => reservationController.getReservation(req, res));
router.patch('/:id', (req, res) => reservationController.cancelReservation(req, res));

export default router;