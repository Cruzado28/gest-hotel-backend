import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { UserController } from '../controllers/user.controller';

/**
 * User Routes - HU 3.2
 * 
 * Rutas para gestionar el perfil del usuario.
 * 
 * IMPORTANTE: Todas estas rutas están protegidas con authMiddleware,
 * lo que significa que el usuario DEBE estar autenticado para acceder.
 * 
 * Estructura de rutas:
 * - GET    /api/v1/users/profile          → Obtener perfil del usuario
 * - PATCH  /api/v1/users/profile          → Actualizar perfil del usuario
 * - GET    /api/v1/users/check-dni/:dni   → Verificar si DNI está disponible (BONUS)
 */

const router = Router();
const userController = new UserController();

/**
 * GET /api/v1/users/profile
 * 
 * Obtiene el perfil del usuario autenticado.
 * 
 * Headers requeridos:
 * - Authorization: Bearer <token>
 * 
 * Respuesta exitosa (200):
 * {
 *   "success": true,
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@gmail.com",
 *     "name": "Juan Pérez",
 *     "phone": "987654321",
 *     "dni": "75268273",
 *     "is_verified_dni": true,
 *     "created_at": "2025-11-08T..."
 *   }
 * }
 */
router.get(
  '/profile',
  authMiddleware,
  (req, res) => userController.getProfile(req, res)
);

/**
 * PATCH /api/v1/users/profile
 * 
 * Actualiza el perfil del usuario autenticado.
 * 
 * ¿Por qué PATCH y no PUT?
 * - PATCH: Actualiza solo los campos enviados (parcial)
 * - PUT: Reemplaza todo el recurso (completo)
 * 
 * Aquí usamos PATCH porque el usuario solo va a actualizar
 * algunos campos (name, phone), no todo el perfil.
 * 
 * Headers requeridos:
 * - Authorization: Bearer <token>
 * - Content-Type: application/json
 * 
 * Body (JSON):
 * {
 *   "name": "Juan Pérez",      // Opcional
 *   "phone": "987654321"        // Opcional
 * }
 * 
 * Respuesta exitosa (200):
 * {
 *   "success": true,
 *   "message": "Perfil actualizado exitosamente",
 *   "user": { ... datos actualizados ... }
 * }
 * 
 * Errores posibles:
 * - 400: Datos inválidos (nombre muy corto, teléfono inválido, etc.)
 * - 401: No autenticado
 * - 404: Usuario no encontrado
 * - 500: Error interno del servidor
 */
router.patch(
  '/profile',
  authMiddleware,
  (req, res) => userController.updateProfile(req, res)
);

/**
 * GET /api/v1/users/check-dni/:dni
 * 
 * Verifica si un DNI está disponible (no registrado por otro usuario).
 * 
 * Esta ruta es BONUS y puede ser útil en el futuro si decides
 * permitir que los usuarios cambien su DNI.
 * 
 * Headers requeridos:
 * - Authorization: Bearer <token>
 * 
 * Ejemplo: GET /api/v1/users/check-dni/75268273
 * 
 * Respuesta exitosa (200):
 * {
 *   "available": true,
 *   "message": "DNI disponible"
 * }
 * 
 * o
 * 
 * {
 *   "available": false,
 *   "message": "Este DNI ya está registrado por otro usuario"
 * }
 */
router.get(
  '/check-dni',
  authMiddleware,
  (req, res) => userController.checkDniAvailability(req, res)
);

export default router;