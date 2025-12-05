import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';

export class AdminController {
  async getAllReservations(req: AuthRequest, res: Response) {
    try {
      const { status, date, client } = req.query;

      let query = supabase
        .from('reservations')
        .select(`
          *,
          rooms (code, type),
          users (name, email, dni)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (date) {
        query = query.eq('check_in', date);
      }

      const { data, error } = await query;

      if (error) throw error;

      res.json({ success: true, reservations: data });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Error al obtener reservas' });
    }
  }

  async createRoom(req: AuthRequest, res: Response) {
  try {
    const { code, type, description, capacity, price_per_night, services, images } = req.body;

    if (!code || !type || !capacity || !price_per_night) {
      return res.status(400).json({ error: 'Campos requeridos: code, type, capacity, price_per_night' });
    }

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        type,
        description: description || null,
        capacity,
        price_per_night,
        services: services || {},
        images: images || []
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe una habitación con ese código' });
      }
      throw error;
    }

    res.status(201).json({ success: true, room: data });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al crear habitación' });
  }
}

  async updateRoomStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['available', 'occupied', 'maintenance', 'cleaning'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Estado inválido', valid: validStatuses });
      }

      const { data, error } = await supabase
        .from('rooms')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, room: data });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Error al actualizar estado' });
    }
  }

  async updateRoom(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const { data, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, room: data });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Error al actualizar habitación' });
    }
  }

  async deleteRoom(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const { error } = await supabase.from('rooms').delete().eq('id', id);

      if (error) throw error;

      res.json({ success: true, message: 'Habitación eliminada' });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Error al eliminar habitación' });
    }
  }

  async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      const { count: totalReservations } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true });

      const { count: pendingPayments } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_payment');

      const { count: confirmedToday } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('check_in', new Date().toISOString().split('T')[0]);

      const { count: totalRooms } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true });

      const { count: availableRooms } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'available');

      res.json({
        success: true,
        stats: {
          totalReservations: totalReservations || 0,
          pendingPayments: pendingPayments || 0,
          confirmedToday: confirmedToday || 0,
          totalRooms: totalRooms || 0,
          availableRooms: availableRooms || 0
        }
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
  }

  async getAllRooms(req: AuthRequest, res: Response) {
    try {
        const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('code', { ascending: true });

        if (error) throw error;

        res.json({ success: true, rooms: data });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener habitaciones' });
    }
  }
}