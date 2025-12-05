import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

/**
 * Payment Routes - HU 4.4
 * 
 * Rutas mejoradas con:
 * - Endpoints existentes mejorados
 * - Nuevos endpoints para auditoría
 * - Endpoint para verificar elegibilidad
 */

const router = Router();
const paymentController = new PaymentController();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// ═══════════════════════════════════════════════════════════════
// ENDPOINTS PRINCIPALES
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/payments/initiate
 * Inicia un nuevo pago
 * 
 * Body: {
 *   reservation_id: string,
 *   method: 'yape' | 'card',
 *   card_data?: { masked_pan: string, expiry: string }
 * }
 */
router.post(
  '/initiate', 
  (req, res) => paymentController.initiatePayment(req, res)
);

/**
 * GET /api/v1/payments/:id
 * Obtiene los detalles de un pago específico
 */
router.get(
  '/:id', 
  (req, res) => paymentController.getPayment(req, res)
);

// ═══════════════════════════════════════════════════════════════
// SIMULACIÓN DE PROCESAMIENTO (Solo para desarrollo)
// En producción, estos serían webhooks reales
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/payments/simulate/yape/:payment_id
 * Simula el procesamiento de un pago con Yape
 * 
 * Query params:
 *   force: 'failed' para forzar un pago fallido (opcional)
 */
router.post(
  '/simulate/yape/:payment_id', 
  (req, res) => paymentController.simulateYapePayment(req, res)
);

/**
 * POST /api/v1/payments/simulate/card/:payment_id
 * Simula el procesamiento de un pago con tarjeta
 * 
 * Query params:
 *   force: 'failed' para forzar un pago fallido (opcional)
 */
router.post(
  '/simulate/card/:payment_id', 
  (req, res) => paymentController.simulateCardPayment(req, res)
);

// ═══════════════════════════════════════════════════════════════
// ✨ NUEVOS ENDPOINTS (HU 4.4)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/payments/history/:reservation_id
 * Obtiene el historial completo de pagos de una reserva
 * Útil para auditoría y debugging
 */
router.get(
  '/history/:reservation_id', 
  (req, res) => paymentController.getPaymentHistory(req, res)
);

/**
 * GET /api/v1/payments/check-eligibility/:reservation_id
 * Verifica si una reserva puede ser pagada
 * Útil para el frontend antes de mostrar la página de pago
 */
router.get(
  '/check-eligibility/:reservation_id', 
  (req, res) => paymentController.checkPaymentEligibility(req, res)
);

export default router;