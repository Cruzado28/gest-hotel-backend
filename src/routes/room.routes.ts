import { Router } from 'express';
import { RoomController } from '../controllers/room.controller';

const router = Router();
const roomController = new RoomController();

// Públicas - no requieren autenticación
router.get('/', (req, res) => roomController.getRooms(req, res));
router.get('/check-availability', (req, res) => roomController.checkAvailability(req, res));
router.get('/:id', (req, res) => roomController.getRoomById(req, res));

export default router;