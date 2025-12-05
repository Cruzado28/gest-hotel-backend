import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();
const adminController = new AdminController();

router.use(authMiddleware);
router.use(adminMiddleware);

// Dashboard
router.get('/stats', (req, res) => adminController.getDashboardStats(req, res));

// Reservas (HU 1.3)
router.get('/reservations', (req, res) => adminController.getAllReservations(req, res));

// Habitaciones (HU 2.1 y 2.2)
router.post('/rooms', (req, res) => adminController.createRoom(req, res));
router.put('/rooms/:id', (req, res) => adminController.updateRoom(req, res));
router.patch('/rooms/:id/status', (req, res) => adminController.updateRoomStatus(req, res));
router.delete('/rooms/:id', (req, res) => adminController.deleteRoom(req, res));
router.get('/rooms', (req, res) => adminController.getAllRooms(req, res));

export default router;