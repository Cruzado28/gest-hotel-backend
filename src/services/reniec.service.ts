// src/services/reniec.service.ts
import { supabase } from '../config/supabase';

export class ReniecService {
  async consultDni(dni: string) {
    // Aquí iría la lógica real. Por ahora devolvemos datos simulados para que no falle.
    console.log('Consultando DNI:', dni);
    return {
      success: true,
      data: {
        dni: dni,
        nombres: 'Usuario de Prueba',
        apellidoPaterno: 'Apellido1',
        apellidoMaterno: 'Apellido2'
      }
    };
  }
} 