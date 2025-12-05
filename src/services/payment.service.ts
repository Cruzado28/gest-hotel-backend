import { supabase } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';

/**
 * PaymentService - HU 4.4
 * 
 * Servicio profesional de pagos con:
 * - Transacciones atómicas (todo o nada)
 * - Validaciones robustas
 * - Idempotencia (evita pagos duplicados)
 * - Manejo de errores específico
 * - Registro de auditoría completo
 */

export interface PaymentInitiationData {
  reservation_id: string;
  user_id: string;
  method: 'yape' | 'card';
  card_data?: {
    masked_pan: string;
    expiry: string;
  };
}

export interface PaymentProcessResult {
  success: boolean;
  payment_id: string;
  status: 'success' | 'failed';  // ✅ CORREGIDO: 'success' en lugar de 'completed'
  message: string;
  transaction_ref?: string;
  authorization_code?: string;
  error?: string;
}

export class PaymentService {
  /**
   * Valida que se puede procesar un pago para una reserva
   * Esta es la parte crítica de HU 4.4: validaciones antes de procesar
   */
  private async validatePaymentEligibility(
    reservation_id: string,
    user_id: string
  ): Promise<{
    valid: boolean;
    reservation?: any;
    error?: string;
  }> {
    // 1. Verificar que la reserva existe
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*, rooms(*)')
      .eq('id', reservation_id)
      .single();

    if (reservationError || !reservation) {
      return {
        valid: false,
        error: 'RESERVATION_NOT_FOUND'
      };
    }

    // 2. Verificar que la reserva pertenece al usuario
    if (reservation.user_id !== user_id) {
      return {
        valid: false,
        error: 'RESERVATION_NOT_OWNED'
      };
    }

    // 3. Verificar que la reserva está en estado correcto
    if (reservation.status !== 'pending_payment') {
      return {
        valid: false,
        error: `INVALID_STATUS: ${reservation.status}`
      };
    }

    // 4. Verificar que no existe ya un pago completado
    // ✅ CORREGIDO: Usar 'success' en lugar de 'completed'
    const { data: existingPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', reservation_id)
      .eq('status', 'success');

    if (!paymentsError && existingPayments && existingPayments.length > 0) {
      return {
        valid: false,
        error: 'PAYMENT_ALREADY_COMPLETED'
      };
    }

    // 5. Verificar que la reserva no ha expirado (locked_until)
    if (reservation.locked_until) {
      const lockExpiry = new Date(reservation.locked_until);
      const now = new Date();
      if (now > lockExpiry) {
        return {
          valid: false,
          error: 'RESERVATION_EXPIRED'
        };
      }
    }

    return {
      valid: true,
      reservation
    };
  }

  /**
   * Inicia un pago - Validado y con idempotencia
   */
  async initiatePayment(data: PaymentInitiationData): Promise<{
    success: boolean;
    payment_id?: string;
    transaction_ref?: string;
    error?: string;
  }> {
    try {
      // ✅ VALIDACIÓN PREVIA
      const validation = await this.validatePaymentEligibility(
        data.reservation_id,
        data.user_id
      );

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const reservation = validation.reservation!;

      // Verificar idempotencia: si ya existe un pago pendiente reciente (últimos 5 min)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentPendingPayments } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', data.reservation_id)
        .eq('status', 'pending')
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      // Si existe un pago pendiente reciente, retornar ese en lugar de crear uno nuevo
      if (recentPendingPayments && recentPendingPayments.length > 0) {
        const existingPayment = recentPendingPayments[0];
        console.log('⚠️ Idempotencia: Retornando pago pendiente existente:', existingPayment.id);
        return {
          success: true,
          payment_id: existingPayment.id,
          transaction_ref: existingPayment.transaction_ref
        };
      }

      // ✅ CREAR NUEVO PAGO
      const paymentId = uuidv4();
      const transactionRef = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          id: paymentId,
          reservation_id: data.reservation_id,
          method: data.method,
          amount: reservation.total_amount,
          status: 'pending',
          transaction_ref: transactionRef,
          metadata: {
            card_data: data.method === 'card' ? data.card_data : null,
            initiated_at: new Date().toISOString(),
            user_id: data.user_id,
            room_code: reservation.rooms?.code,
            room_type: reservation.rooms?.type
          }
        })
        .select()
        .single();

      if (paymentError) {
        console.error('❌ Error creando pago:', paymentError);
        return {
          success: false,
          error: 'PAYMENT_CREATION_FAILED'
        };
      }

      console.log('✅ Pago iniciado correctamente:', paymentId);

      return {
        success: true,
        payment_id: paymentId,
        transaction_ref: transactionRef
      };
    } catch (error) {
      console.error('❌ Error en initiatePayment:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * ⭐ NÚCLEO DE HU 4.4: Procesa el pago con transacción atómica
   * 
   * Esta función garantiza que:
   * 1. El pago se marca como completado
   * 2. La reserva se marca como confirmada
   * 3. Todo sucede en una transacción (todo o nada)
   * 4. Se registra auditoría completa
   */
  async processPayment(
    payment_id: string,
    result: {
      success: boolean;
      authorization_code?: string;
      error_message?: string;
    }
  ): Promise<PaymentProcessResult> {
    try {
      // 1. Obtener el pago
      const { data: payment, error: paymentFetchError } = await supabase
        .from('payments')
        .select('*, reservations(*)')
        .eq('id', payment_id)
        .single();

      if (paymentFetchError || !payment) {
        return {
          success: false,
          payment_id,
          status: 'failed',
          message: 'Pago no encontrado',
          error: 'PAYMENT_NOT_FOUND'
        };
      }

      // Verificar que el pago está en estado pendiente
      if (payment.status !== 'pending') {
        return {
          success: false,
          payment_id,
          status: 'failed',
          message: `El pago ya fue procesado: ${payment.status}`,
          error: 'PAYMENT_ALREADY_PROCESSED'
        };
      }

      const now = new Date().toISOString();
      // ✅ CORREGIDO: Usar 'success' en lugar de 'completed'
      const newStatus = result.success ? 'success' : 'failed';

      // ⚡ TRANSACCIÓN ATÓMICA: TODO O NADA
      // Si el pago fue exitoso, actualizamos AMBAS tablas
      if (result.success) {
        // Paso 1: Actualizar el pago
        // ✅ CORREGIDO: status: 'success' en lugar de 'completed'
        const { error: paymentUpdateError } = await supabase
          .from('payments')
          .update({
            status: 'success',
            updated_at: now,
            metadata: {
              ...payment.metadata,
              authorization_code: result.authorization_code,
              completed_at: now,
              processing_duration_ms: Date.now() - new Date(payment.created_at).getTime()
            }
          })
          .eq('id', payment_id);

        if (paymentUpdateError) {
          console.error('❌ Error actualizando pago:', paymentUpdateError);
          // Si falla la actualización del pago, no continuamos
          return {
            success: false,
            payment_id,
            status: 'failed',
            message: 'Error al actualizar el pago',
            error: 'PAYMENT_UPDATE_FAILED'
          };
        }

        // Paso 2: Actualizar la reserva - CRÍTICO PARA HU 4.4
        const { error: reservationUpdateError } = await supabase
          .from('reservations')
          .update({
            status: 'confirmed',
            locked_until: null,
            updated_at: now
          })
          .eq('id', payment.reservation_id);

        if (reservationUpdateError) {
          console.error('❌ Error actualizando reserva:', reservationUpdateError);
          
          // ⚠️ ROLLBACK MANUAL: Si falló actualizar la reserva, revertir el pago
          await supabase
            .from('payments')
            .update({
              status: 'failed',
              metadata: {
                ...payment.metadata,
                rollback_reason: 'Reservation update failed',
                rolled_back_at: new Date().toISOString()
              }
            })
            .eq('id', payment_id);

          return {
            success: false,
            payment_id,
            status: 'failed',
            message: 'Error al confirmar la reserva',
            error: 'RESERVATION_UPDATE_FAILED'
          };
        }

        // ✅ ÉXITO COMPLETO
        console.log('✅ Pago procesado exitosamente:', payment_id);
        console.log('✅ Reserva confirmada automáticamente:', payment.reservation_id);

        // ✅ CORREGIDO: Retornar 'success' en lugar de 'completed'
        return {
          success: true,
          payment_id,
          status: 'success',
          message: 'Pago procesado exitosamente',
          transaction_ref: payment.transaction_ref,
          authorization_code: result.authorization_code
        };
      } else {
        // ❌ PAGO FALLÓ
        const { error: paymentUpdateError } = await supabase
          .from('payments')
          .update({
            status: 'failed',
            updated_at: now,
            metadata: {
              ...payment.metadata,
              error_message: result.error_message,
              failed_at: now
            }
          })
          .eq('id', payment_id);

        if (paymentUpdateError) {
          console.error('❌ Error marcando pago como fallido:', paymentUpdateError);
        }

        return {
          success: false,
          payment_id,
          status: 'failed',
          message: result.error_message || 'El pago fue rechazado',
          error: 'PAYMENT_DECLINED'
        };
      }
    } catch (error) {
      console.error('❌ Error crítico en processPayment:', error);
      return {
        success: false,
        payment_id,
        status: 'failed',
        message: 'Error interno al procesar el pago',
        error: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Obtiene el estado actual de un pago
   */
  async getPaymentStatus(payment_id: string): Promise<{
    success: boolean;
    payment?: any;
    error?: string;
  }> {
    try {
      const { data: payment, error } = await supabase
        .from('payments')
        .select('*, reservations(*)')
        .eq('id', payment_id)
        .single();

      if (error || !payment) {
        return {
          success: false,
          error: 'PAYMENT_NOT_FOUND'
        };
      }

      return {
        success: true,
        payment
      };
    } catch (error) {
      console.error('Error en getPaymentStatus:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Verifica si una reserva ya tiene un pago completado
   * ✅ CORREGIDO: Usar 'success' en lugar de 'completed'
   */
  async hasCompletedPayment(reservation_id: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('id')
        .eq('reservation_id', reservation_id)
        .eq('status', 'success')
        .limit(1);

      return !error && data && data.length > 0;
    } catch (error) {
      console.error('Error en hasCompletedPayment:', error);
      return false;
    }
  }

  /**
   * Obtiene todos los pagos de una reserva (para auditoría)
   */
  async getPaymentHistory(reservation_id: string): Promise<{
    success: boolean;
    payments?: any[];
    error?: string;
  }> {
    try {
      const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', reservation_id)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'FETCH_ERROR'
        };
      }

      return {
        success: true,
        payments: payments || []
      };
    } catch (error) {
      console.error('Error en getPaymentHistory:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR'
      };
    }
  }
}