import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';

export class DiscountController {
  /**
   * GET /api/v1/discounts/applicable
   * Obtiene descuentos aplicables según noches y usuario
   */
  async getApplicableDiscounts(req: AuthRequest, res: Response) {
    try {
      const { nights } = req.query;
      const userId = req.user!.id;

      if (!nights || isNaN(Number(nights))) {
        return res.status(400).json({ error: 'Parámetro nights requerido' });
      }

      const nightsNum = Number(nights);

      // Verificar si es primera reserva
      const { count } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const isFirstReservation = count === 0;

      // Obtener descuentos activos y aplicables
      let query = supabase
        .from('discounts')
        .select('*')
        .eq('is_active', true)
        .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().split('T')[0]}`)
        .lte('min_nights', nightsNum);

      const { data: discounts, error } = await query;

      if (error) throw error;

      // Filtrar descuento de primera reserva
      const applicableDiscounts = discounts?.filter(d => {
        if (d.code === 'PRIMERAVEZ') return isFirstReservation;
        return true;
      }) || [];

      res.json({
        success: true,
        discounts: applicableDiscounts,
        isFirstReservation
      });
    } catch (error) {
      console.error('Error obteniendo descuentos:', error);
      res.status(500).json({ error: 'Error al obtener descuentos' });
    }
  }

  /**
   * POST /api/v1/discounts/calculate
   * Calcula el descuento para un monto específico
   */
  async calculateDiscount(req: Request, res: Response) {
    try {
      const { discount_id, subtotal } = req.body;

      if (!discount_id || !subtotal) {
        return res.status(400).json({ error: 'discount_id y subtotal requeridos' });
      }

      const { data: discount, error } = await supabase
        .from('discounts')
        .select('*')
        .eq('id', discount_id)
        .single();

      if (error || !discount) {
        return res.status(404).json({ error: 'Descuento no encontrado' });
      }

      let discountAmount = 0;

      if (discount.type === 'percentage') {
        discountAmount = (subtotal * discount.value) / 100;
      } else {
        discountAmount = discount.value;
      }

      const total = Math.max(0, subtotal - discountAmount);

      res.json({
        success: true,
        discount_amount: discountAmount,
        total_after_discount: total,
        discount_info: discount
      });
    } catch (error) {
      console.error('Error calculando descuento:', error);
      res.status(500).json({ error: 'Error al calcular descuento' });
    }
  }
}