import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { PaymentService } from '../services/payment.service';
import { EmailService } from '../services/email.service';

/**
 * PaymentController Mejorado - HU 4.4
 * 
 * Controller que usa el PaymentService robusto para:
 * - Procesar pagos con transacciones
 * - Validar automáticamente
 * - Actualizar estado de reserva automáticamente
 * - Enviar emails de confirmación
 */
export class PaymentController {
  private paymentService = new PaymentService();
  private emailService = new EmailService();

  /**
   * Inicia un pago con validaciones robustas
   */
  async initiatePayment(req: AuthRequest, res: Response) {
    try {
      const { reservation_id, method, card_data } = req.body;
      const user_id = req.user!.id;

      // Validaciones de entrada
      if (!reservation_id || !method) {
        return res.status(400).json({ 
          error: 'Faltan datos requeridos',
          details: 'reservation_id y method son obligatorios'
        });
      }

      if (!['yape', 'card'].includes(method)) {
        return res.status(400).json({ 
          error: 'Método de pago inválido',
          details: 'Método debe ser "yape" o "card"'
        });
      }

      if (method === 'card' && !card_data) {
        return res.status(400).json({ 
          error: 'Datos de tarjeta requeridos',
          details: 'Para pagos con tarjeta se requiere card_data'
        });
      }

      // ✨ Usar el servicio mejorado
      const result = await this.paymentService.initiatePayment({
        reservation_id,
        user_id,
        method,
        card_data
      });

      if (!result.success) {
        // Mapear errores a mensajes amigables
        const errorMessages: Record<string, string> = {
          'RESERVATION_NOT_FOUND': 'La reserva no existe',
          'RESERVATION_NOT_OWNED': 'No tienes permiso para pagar esta reserva',
          'INVALID_STATUS': 'Esta reserva ya fue procesada o cancelada',
          'PAYMENT_ALREADY_COMPLETED': 'Esta reserva ya tiene un pago completado',
          'RESERVATION_EXPIRED': 'El tiempo para completar esta reserva ha expirado',
          'PAYMENT_CREATION_FAILED': 'Error al crear el registro de pago',
          'INTERNAL_ERROR': 'Error interno del servidor'
        };

        const message = errorMessages[result.error || ''] || 'Error al iniciar el pago';
        const statusCode = result.error === 'RESERVATION_NOT_FOUND' ? 404 : 400;

        return res.status(statusCode).json({ 
          error: message,
          code: result.error
        });
      }

      // ✅ Éxito
      res.status(201).json({
        success: true,
        payment_id: result.payment_id,
        transaction_ref: result.transaction_ref,
        status: 'pending',
        message: 'Pago iniciado correctamente'
      });
    } catch (error) {
      console.error('❌ Error en initiatePayment:', error);
      res.status(500).json({ 
        error: 'Error interno al iniciar el pago',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Simula procesamiento de pago con Yape
   * En producción, esto sería un webhook de Yape
   */
  async simulateYapePayment(req: AuthRequest, res: Response) {
    try {
      const { payment_id } = req.params;
      const force = req.query.force as string;

      if (!payment_id) {
        return res.status(400).json({ error: 'payment_id es requerido' });
      }

      // Simular delay de procesamiento de Yape (2 segundos)
      console.log('⏳ Simulando procesamiento de pago con Yape...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const success = force !== 'failed';
      const authorizationCode = success 
        ? `YAPE${Math.random().toString(36).substr(2, 8).toUpperCase()}` 
        : undefined;

      // ⭐ USAR EL SERVICIO ROBUSTO CON TRANSACCIONES
      const result = await this.paymentService.processPayment(payment_id, {
        success,
        authorization_code: authorizationCode,
        error_message: success ? undefined : 'Pago rechazado por el usuario en Yape'
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          payment_id,
          status: result.status,
          message: result.message,
          error: result.error
        });
      }

      // ✅ Pago exitoso - Enviar email de confirmación
      // ✅ CORREGIDO: Cambiar 'completed' a 'success'
      if (result.status === 'success') {
        try {
          const paymentDetails = await this.paymentService.getPaymentStatus(payment_id);
          if (paymentDetails.success && paymentDetails.payment) {
            await this.emailService.sendReservationConfirmation(
              paymentDetails.payment.reservation_id
            );
            console.log('✅ Email de confirmación enviado');
          }
        } catch (emailError) {
          console.error('⚠️ Error al enviar email (no crítico):', emailError);
          // No fallar la respuesta si el email falla
        }
      }

      res.json({
        success: true,
        payment_id,
        status: result.status,
        message: result.message,
        transaction_ref: result.transaction_ref,
        authorization_code: authorizationCode
      });
    } catch (error) {
      console.error('❌ Error en simulateYapePayment:', error);
      res.status(500).json({ 
        error: 'Error al procesar pago con Yape',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Simula procesamiento de pago con tarjeta
   * En producción, esto sería un webhook del gateway de pagos
   */
  async simulateCardPayment(req: AuthRequest, res: Response) {
    try {
      const { payment_id } = req.params;
      const force = req.query.force as string;

      if (!payment_id) {
        return res.status(400).json({ error: 'payment_id es requerido' });
      }

      // Simular delay de procesamiento de tarjeta (1.5 segundos)
      console.log('⏳ Simulando procesamiento de pago con tarjeta...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      const success = force !== 'failed';
      const authorizationCode = success 
        ? `AUTH${Math.random().toString(36).substr(2, 6).toUpperCase()}` 
        : undefined;

      // ⭐ USAR EL SERVICIO ROBUSTO CON TRANSACCIONES
      const result = await this.paymentService.processPayment(payment_id, {
        success,
        authorization_code: authorizationCode,
        error_message: success ? undefined : 'Tarjeta rechazada por el banco emisor'
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          payment_id,
          status: result.status,
          message: result.message,
          error: result.error
        });
      }

      // ✅ Pago exitoso - Enviar email de confirmación
      // ✅ CORREGIDO: Cambiar 'completed' a 'success'
      if (result.status === 'success') {
        try {
          const paymentDetails = await this.paymentService.getPaymentStatus(payment_id);
          if (paymentDetails.success && paymentDetails.payment) {
            await this.emailService.sendReservationConfirmation(
              paymentDetails.payment.reservation_id
            );
            console.log('✅ Email de confirmación enviado');
          }
        } catch (emailError) {
          console.error('⚠️ Error al enviar email (no crítico):', emailError);
          // No fallar la respuesta si el email falla
        }
      }

      res.json({
        success: true,
        payment_id,
        status: result.status,
        message: result.message,
        transaction_ref: result.transaction_ref,
        authorization_code: authorizationCode
      });
    } catch (error) {
      console.error('❌ Error en simulateCardPayment:', error);
      res.status(500).json({ 
        error: 'Error al procesar pago con tarjeta',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Obtiene el estado actual de un pago
   */
  async getPayment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: 'payment_id es requerido' });
      }

      const result = await this.paymentService.getPaymentStatus(id);

      if (!result.success) {
        const statusCode = result.error === 'PAYMENT_NOT_FOUND' ? 404 : 500;
        return res.status(statusCode).json({ 
          error: result.error === 'PAYMENT_NOT_FOUND' 
            ? 'Pago no encontrado' 
            : 'Error al obtener el pago'
        });
      }

      res.json(result.payment);
    } catch (error) {
      console.error('❌ Error en getPayment:', error);
      res.status(500).json({ 
        error: 'Error al obtener el pago',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * ✨ NUEVO: Obtiene el historial de pagos de una reserva
   * Útil para auditoría y debugging
   */
  async getPaymentHistory(req: AuthRequest, res: Response) {
    try {
      const { reservation_id } = req.params;

      if (!reservation_id) {
        return res.status(400).json({ error: 'reservation_id es requerido' });
      }

      const result = await this.paymentService.getPaymentHistory(reservation_id);

      if (!result.success) {
        return res.status(500).json({ 
          error: 'Error al obtener historial de pagos'
        });
      }

      res.json({
        reservation_id,
        payments: result.payments,
        count: result.payments?.length || 0
      });
    } catch (error) {
      console.error('❌ Error en getPaymentHistory:', error);
      res.status(500).json({ 
        error: 'Error al obtener historial',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * ✨ NUEVO: Verifica si una reserva puede ser pagada
   * Útil para el frontend antes de mostrar la página de pago
   */
  async checkPaymentEligibility(req: AuthRequest, res: Response) {
    try {
      const { reservation_id } = req.params;
      const user_id = req.user!.id;

      if (!reservation_id) {
        return res.status(400).json({ error: 'reservation_id es requerido' });
      }

      // Verificar si ya existe un pago completado
      const hasPayment = await this.paymentService.hasCompletedPayment(reservation_id);

      if (hasPayment) {
        return res.json({
          eligible: false,
          reason: 'ALREADY_PAID',
          message: 'Esta reserva ya tiene un pago completado'
        });
      }

      // Aquí podrías agregar más validaciones si las necesitas

      res.json({
        eligible: true,
        message: 'La reserva puede ser pagada'
      });
    } catch (error) {
      console.error('❌ Error en checkPaymentEligibility:', error);
      res.status(500).json({ 
        error: 'Error al verificar elegibilidad',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}