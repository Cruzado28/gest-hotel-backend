import { Request, Response } from 'express';
import { RoomRepository } from '../repositories/room.repository';

export class RoomController {
  private roomRepository = new RoomRepository();

  async getRooms(req: Request, res: Response) {
    try {
      const filters = {
        type: req.query.type as string,
        precio_min: req.query.precio_min ? Number(req.query.precio_min) : undefined,
        precio_max: req.query.precio_max ? Number(req.query.precio_max) : undefined,
        fecha_inicio: req.query.fecha_inicio as string,
        fecha_fin: req.query.fecha_fin as string,
        servicios: req.query.servicios 
          ? (req.query.servicios as string).split(',')
          : undefined
      };

      const rooms = await this.roomRepository.findAll(filters);

      res.json({
        data: rooms,
        total: rooms?.length || 0
      });
    } catch (error) {
      console.error('Error fetching rooms:', error);
      res.status(500).json({ error: 'Error al obtener habitaciones' });
    }
  }

  async getRoomById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const room = await this.roomRepository.findById(id);

      if (!room) {
        return res.status(404).json({ error: 'Habitación no encontrada' });
      }

      res.json(room);
    } catch (error) {
      console.error('Error fetching room:', error);
      res.status(500).json({ error: 'Error al obtener habitación' });
    }
  }

  async checkAvailability(req: Request, res: Response) {
    try {
      const { room_id, check_in, check_out } = req.query;

      if (!room_id || !check_in || !check_out) {
        return res.status(400).json({ 
          error: 'Faltan parámetros: room_id, check_in, check_out' 
        });
      }

      const isAvailable = await this.roomRepository.checkAvailability(
        room_id as string,
        check_in as string,
        check_out as string
      );

      res.json({ available: isAvailable });
    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).json({ error: 'Error al verificar disponibilidad' });
    }
  }
}