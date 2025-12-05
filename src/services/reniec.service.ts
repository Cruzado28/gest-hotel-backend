// src/services/reniec.service.ts
import { supabase } from '../config/supabase';

export class ReniecService {
  async consultDni(dni: string) {
    console.log('⚠️ Servicio Reniec simplificado consultando:', dni);
    // Retornamos datos falsos para que no rompa el servidor
    return {
      success: true,
      data: {
        dni: dni,
        nombres: 'Usuario',
        apellidoPaterno: 'Prueba',
        apellidoMaterno: 'Sistema'
      }
    };
  }
}