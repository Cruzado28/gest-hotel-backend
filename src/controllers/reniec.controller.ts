import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export class ReniecController {
  async verify(req: Request, res: Response) {
    try {
      const { dni, birthdate } = req.body;
      const userId = (req as any).user?.id;

      console.log('📥 [RENIEC CONTROLLER] Solicitud de verificación:', { dni, birthdate, userId });

      if (!dni || !birthdate) {
        return res.status(400).json({ 
          success: false,
          error: 'DNI y fecha de nacimiento son requeridos' 
        });
      }

      if (!userId) {
        return res.status(401).json({ 
          success: false,
          error: 'Usuario no autenticado' 
        });
      }

      // Validar formato de DNI
      if (!/^\d{8}$/.test(dni)) {
        return res.status(400).json({
          success: false,
          error: 'DNI debe tener 8 dígitos numéricos'
        });
      }

      // Calcular edad
      const today = new Date();
      const birth = new Date(birthdate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      console.log('📅 [RENIEC CONTROLLER] Edad calculada:', age, 'años');

      // Validar mayoría de edad
      if (age < 18) {
        return res.status(400).json({
          success: false,
          error: `Debes ser mayor de 18 años. Edad actual: ${age} años`,
          age,
          isAdult: false
        });
      }

      console.log('✅ [RENIEC CONTROLLER] Validación exitosa, guardando datos...');

      // Actualizar usuario en Supabase
      const { data: userData, error: updateError } = await supabase
        .from('users')
        .update({
          dni: dni,
          birthdate: birthdate,
          is_verified_dni: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ [RENIEC CONTROLLER] Error al actualizar usuario:', updateError);
        return res.status(500).json({ 
          success: false,
          error: 'Error al actualizar datos del usuario' 
        });
      }

      console.log('✅ [RENIEC CONTROLLER] Datos guardados correctamente');

      res.json({
        success: true,
        message: 'DNI verificado exitosamente',
        data: {
          dni: dni,
          birthdate: birthdate,
          age: age,
          is_verified_dni: true
        },
        user: userData
      });
    } catch (error) {
      console.error('❌ [RENIEC CONTROLLER] Error inesperado:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error interno del servidor' 
      });
    }
  }

  async getStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ 
          error: 'Usuario no autenticado' 
        });
      }

      const { data, error } = await supabase
        .from('users')
        .select('dni, is_verified_dni, birthdate')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ [RENIEC CONTROLLER] Error al obtener estado:', error);
        return res.status(500).json({ 
          error: 'Error al obtener estado de verificación' 
        });
      }

      res.json({
        is_verified: data.is_verified_dni || false,
        has_dni: !!data.dni,
        dni: data.dni || null
      });
    } catch (error) {
      console.error('❌ [RENIEC CONTROLLER] Error inesperado:', error);
      res.status(500).json({ 
        error: 'Error al obtener estado' 
      });
    }
  }
}

export const reniecController = new ReniecController();