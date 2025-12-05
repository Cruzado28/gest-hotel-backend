import { Router } from 'express';
import { reniecController } from '../controllers/reniec.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// POST /api/v1/integrations/reniec/verify - Verificar DNI
router.post('/verify', (req, res) => reniecController.verify(req, res));

// GET /api/v1/integrations/reniec/status - Obtener estado de verificación
router.get('/status', (req, res) => reniecController.getStatus(req, res));

export default router;