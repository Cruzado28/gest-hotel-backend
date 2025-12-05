import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';
import { PDFService } from '../services/pdf.service';

export class ReservationController {
  async createReservation(req: AuthRequest, res: Response) {
    try {
      const { room_id, check_in, check_out, guests, guest_details, services, discount_id } = req.body;
      const userId = req.user!.id;

      console.log('🔵 [CREATE RESERVATION] Iniciando proceso de creación');
      console.log('📦 [CREATE RESERVATION] Body recibido:', req.body);

      const normalizedCheckIn = check_in.split('T')[0];
      const normalizedCheckOut = check_out.split('T')[0];

      // Verificar disponibilidad
      const { data: isAvailable } = await supabase
        .rpc('check_room_availability', {
          p_room_id: room_id,
          p_check_in: normalizedCheckIn,
          p_check_out: normalizedCheckOut
        });

      if (!isAvailable) {
        return res.status(409).json({ 
          error: 'La habitación no está disponible para las fechas seleccionadas' 
        });
      }

      // Obtener precio de habitación
      const { data: room } = await supabase
        .from('rooms')
        .select('price_per_night')
        .eq('id', room_id)
        .single();

      if (!room) {
        return res.status(404).json({ error: 'Habitación no encontrada' });
      }

      // Calcular noches y total
      const [y1, m1, d1] = normalizedCheckIn.split('-').map(Number);
      const [y2, m2, d2] = normalizedCheckOut.split('-').map(Number);
      const checkInDate = new Date(y1, m1 - 1, d1);
      const checkOutDate = new Date(y2, m2 - 1, d2);
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      let totalAmount = room.price_per_night * nights;

      console.log('💰 Subtotal habitación:', totalAmount);

      // Agregar servicios
      if (services && Array.isArray(services) && services.length > 0) {
        const servicesTotal = services.reduce((sum: number, s: any) => sum + (s.subtotal || 0), 0);
        totalAmount += servicesTotal;
        console.log('🛎️ Total servicios:', servicesTotal);
      }

      // Aplicar descuento
      let discountAmount = 0;
      if (discount_id) {
        const { data: discount } = await supabase
          .from('discounts')
          .select('*')
          .eq('id', discount_id)
          .eq('is_active', true)
          .single();

        if (discount) {
          if (discount.type === 'percentage') {
            discountAmount = (totalAmount * discount.value) / 100;
          } else {
            discountAmount = discount.value;
          }
          totalAmount = Math.max(0, totalAmount - discountAmount);
          console.log('💰 Descuento aplicado:', discountAmount);
        }
      }

      console.log('💰 Total final:', totalAmount);

      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);

      // Crear reserva
      const { data: reservation, error } = await supabase
        .from('reservations')
        .insert({
          user_id: userId,
          room_id,
          check_in: normalizedCheckIn,
          check_out: normalizedCheckOut,
          guests,
          guest_details,
          total_amount: totalAmount,
          status: 'pending_payment',
          locked_until: lockedUntil.toISOString()
        })
        .select()
        .single();

      if (error || !reservation) {
        console.error('❌ Error creando reserva:', error);
        return res.status(500).json({ 
          error: 'Error al crear la reserva',
          details: error?.message 
        });
      }

      // Agregar servicios
      if (services && Array.isArray(services) && services.length > 0) {
        const servicesData = services.map((s: any) => ({
          reservation_id: reservation.id,
          service_id: s.service_id,
          quantity: s.quantity || 1,
          subtotal: s.subtotal
        }));

        const { error: servicesError } = await supabase
          .from('reservation_services')
          .insert(servicesData);

        if (servicesError) {
          console.error('⚠️ Error agregando servicios:', servicesError);
        } else {
          console.log('✅ Servicios agregados');
        }
      }

      // Guardar descuento
      if (discount_id && discountAmount > 0) {
        const { error: discountError } = await supabase
          .from('reservation_discounts')
          .insert({
            reservation_id: reservation.id,
            discount_id,
            discount_amount: discountAmount
          });

        if (discountError) {
          console.error('⚠️ Error guardando descuento:', discountError);
        } else {
          console.log('✅ Descuento guardado');
        }
      }

      console.log('✅ Reserva creada exitosamente:', reservation.id);
      res.status(201).json(reservation);
    } catch (error) {
      console.error('💥 Error in createReservation:', error);
      res.status(500).json({ 
        error: 'Error al procesar la reserva',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getReservations(req: AuthRequest, res: Response) {
    try {
      const userId = req.query.user_id || req.user!.id;

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          rooms(*),
          payments(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reservations:', error);
        return res.status(500).json({ error: 'Error al obtener reservas' });
      }

      res.json(data);
    } catch (error) {
      console.error('Error in getReservations:', error);
      res.status(500).json({ error: 'Error al procesar solicitud' });
    }
  }

  async getReservation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          rooms(*),
          users(*),
          payments(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching reservation:', error);
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }

      if (data.user_id !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      res.json(data);
    } catch (error) {
      console.error('Error in getReservation:', error);
      res.status(500).json({ error: 'Error al obtener reserva' });
    }
  }

  async getReservationDiscounts(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('reservation_discounts')
        .select(`
          *,
          discounts (
            code,
            description,
            type,
            value
          )
        `)
        .eq('reservation_id', id);

      if (error) throw error;

      res.json({ success: true, discounts: data });
    } catch (error) {
      console.error('Error obteniendo descuentos:', error);
      res.status(500).json({ error: 'Error al obtener descuentos' });
    }
  }

  async cancelReservation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const { data: reservation } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', id)
        .single();

      if (!reservation) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }

      if (reservation.user_id !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      if (reservation.status === 'completed' || reservation.status === 'cancelled') {
        return res.status(400).json({ 
          error: 'Esta reserva no puede ser cancelada' 
        });
      }

      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) {
        console.error('Error cancelling reservation:', error);
        return res.status(500).json({ error: 'Error al cancelar reserva' });
      }

      res.json({ message: 'Reserva cancelada exitosamente' });
    } catch (error) {
      console.error('Error in cancelReservation:', error);
      res.status(500).json({ error: 'Error al procesar cancelación' });
    }
  }

  async generateReservationPDF(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const { data: reservation, error } = await supabase
        .from('reservations')
        .select(`
          *,
          users (
            id,
            email,
            name,
            phone,
            dni
          ),
          rooms (
            code,
            type,
            description,
            price_per_night
          ),
          payments (
            id,
            method,
            status,
            transaction_ref
          )
        `)
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .single();

      if (error || !reservation) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }

      // Obtener servicios
      const { data: services } = await supabase
        .from('reservation_services')
        .select(`
          *,
          services (
            name,
            price
          )
        `)
        .eq('reservation_id', id);

      // Obtener descuentos
      const { data: discounts } = await supabase
        .from('reservation_discounts')
        .select(`
          *,
          discounts (
            code,
            description,
            type,
            value
          )
        `)
        .eq('reservation_id', id);

      const pdfService = new PDFService();
      const pdfUrl = await pdfService.generateReservationPDF({
        ...reservation,
        services: services || [],
        discounts: discounts || []
      } as any);

      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Error al descargar PDF: ${response.status}`);
      }

      const pdfBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Reserva-${id.substring(0, 8)}.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error('Error in generateReservationPDF:', error);
      res.status(500).json({ 
        error: 'Error al generar el PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}