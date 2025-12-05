import { supabase } from '../config/supabase';

export class RoomRepository {
  async findAll(filters?: {
    type?: string;
    precio_min?: number;
    precio_max?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    servicios?: string[];
  }) {
    let query = supabase
      .from('rooms')
      .select('*')
      .eq('status', 'available');

    // Filtro por tipo
    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    // Filtro por precio
    if (filters?.precio_min) {
      query = query.gte('price_per_night', filters.precio_min);
    }
    if (filters?.precio_max) {
      query = query.lte('price_per_night', filters.precio_max);
    }

    // Filtro por servicios (ejemplo: wifi, tv, minibar)
    if (filters?.servicios && filters.servicios.length > 0) {
      filters.servicios.forEach(servicio => {
        query = query.contains('services', { [servicio]: true });
      });
    }

    const { data, error } = await query.order('price_per_night', { ascending: true });

    if (error) throw error;

    // Si hay filtro de fechas, verificar disponibilidad
    if (filters?.fecha_inicio && filters?.fecha_fin && data) {
      const availableRooms = [];
      
      for (const room of data) {
        const isAvailable = await this.checkAvailability(
          room.id,
          filters.fecha_inicio,
          filters.fecha_fin
        );
        if (isAvailable) {
          availableRooms.push(room);
        }
      }
      
      return availableRooms;
    }

    return data;
  }

  async findById(id: string) {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async checkAvailability(roomId: string, checkIn: string, checkOut: string) {
    const { data, error } = await supabase.rpc('check_room_availability', {
      p_room_id: roomId,
      p_check_in: checkIn,
      p_check_out: checkOut
    });

    if (error) throw error;
    return data;
  }
}