import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';  // ← ✅ CAMBIO: Era "authenticate", ahora es "authMiddleware"

const router = Router();
const authController = new AuthController();

router.post('/google', (req, res) => authController.googleLogin(req, res));
router.get('/me', authMiddleware, (req, res) => authController.getCurrentUser(req, res));  // ← ✅ CAMBIO: Era "authenticate", ahora es "authMiddleware"

export default router;