import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * ServiceController - HU 2.4
 * Gestiona servicios adicionales disponibles
 */
export class ServiceController {
  /**
   * GET /api/v1/services
   * Lista todos los servicios activos
   */
  async getServices(req: Request, res: Response) {
    try {
      const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      res.json({
        success: true,
        services
      });
    } catch (error) {
      console.error('Error obteniendo servicios:', error);
      res.status(500).json({ 
        error: 'Error al obtener servicios' 
      });
    }
  }

  /**
   * GET /api/v1/services/reservation/:reservationId
   * Obtiene servicios de una reserva específica
   */
  async getReservationServices(req: Request, res: Response) {
    try {
      const { reservationId } = req.params;

      const { data: reservationServices, error } = await supabase
        .from('reservation_services')
        .select(`
          id,
          quantity,
          subtotal,
          service_id,
          services (
            id,
            name,
            description,
            price,
            icon
          )
        `)
        .eq('reservation_id', reservationId);

      if (error) throw error;

      res.json({
        success: true,
        services: reservationServices
      });
    } catch (error) {
      console.error('Error obteniendo servicios de reserva:', error);
      res.status(500).json({ 
        error: 'Error al obtener servicios' 
      });
    }
  }
}