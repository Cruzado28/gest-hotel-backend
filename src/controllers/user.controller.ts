import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';

/**
 * UserController - HU 3.2
 * 
 * Controlador para gestionar operaciones del usuario:
 * - Obtener perfil actual
 * - Actualizar información del perfil
 * 
 * IMPORTANTE: Solo permite que un usuario edite su propio perfil
 */
export class UserController {
  /**
   * Obtiene el perfil del usuario autenticado
   * 
   * Esta función es útil para pre-llenar el formulario del frontend
   * con los datos actuales del usuario antes de que los edite.
   */
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const user_id = req.user!.id;

      console.log('📋 [GET PROFILE] Obteniendo perfil de usuario:', user_id);

      // Obtener datos del usuario desde Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, name, phone, dni, is_verified_dni, created_at')
        .eq('id', user_id)
        .single();

      if (error || !user) {
        console.error('❌ [GET PROFILE] Error:', error);
        return res.status(404).json({ 
          error: 'Usuario no encontrado' 
        });
      }

      console.log('✅ [GET PROFILE] Perfil obtenido exitosamente');

      res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('❌ [GET PROFILE] Error interno:', error);
      res.status(500).json({ 
        error: 'Error al obtener el perfil',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Actualiza el perfil del usuario autenticado
   * 
   * Campos editables:
   * - name: Nombre completo del usuario
   * - phone: Número de teléfono
   * 
   * Campos NO editables (por seguridad):
   * - email: Viene de Google OAuth, no se puede cambiar
   * - dni: Una vez verificado, no se puede cambiar (requiere re-verificación)
   * - is_verified_dni: Solo el sistema puede cambiar esto
   */
  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const user_id = req.user!.id;
      const { name, phone } = req.body;

      console.log('📝 [UPDATE PROFILE] Actualizando perfil de usuario:', user_id);
      console.log('📦 [UPDATE PROFILE] Datos recibidos:', { name, phone });

      // ✅ VALIDACIÓN 1: Al menos un campo debe estar presente
      if (!name && !phone) {
        return res.status(400).json({ 
          error: 'Debes proporcionar al menos un campo para actualizar',
          details: 'Campos permitidos: name, phone'
        });
      }

      // ✅ VALIDACIÓN 2: Nombre no puede estar vacío si se proporciona
      if (name !== undefined && name.trim().length === 0) {
        return res.status(400).json({ 
          error: 'El nombre no puede estar vacío'
        });
      }

      // ✅ VALIDACIÓN 3: Nombre debe tener al menos 2 caracteres
      if (name && name.trim().length < 2) {
        return res.status(400).json({ 
          error: 'El nombre debe tener al menos 2 caracteres'
        });
      }

      // ✅ VALIDACIÓN 4: Teléfono debe tener formato válido (si se proporciona)
      if (phone !== undefined) {
        // Permitir vacío (el usuario puede querer borrar su teléfono)
        if (phone !== '' && phone !== null) {
          // Si no está vacío, validar formato
          const phoneRegex = /^[0-9]{9,15}$/;
          const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
          
          if (!phoneRegex.test(cleanPhone)) {
            return res.status(400).json({ 
              error: 'El teléfono debe contener entre 9 y 15 dígitos'
            });
          }
        }
      }

      // Construir objeto con solo los campos que se van a actualizar
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (name !== undefined) {
        updateData.name = name.trim();
      }

      if (phone !== undefined) {
        // Si el teléfono está vacío, guardarlo como null en la BD
        updateData.phone = phone === '' ? null : phone;
      }

      console.log('💾 [UPDATE PROFILE] Datos a actualizar:', updateData);

      // 🔒 SEGURIDAD: Solo actualizar el perfil del usuario autenticado
      // La cláusula .eq('id', user_id) garantiza que un usuario
      // no pueda modificar el perfil de otro usuario
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user_id)
        .select('id, email, name, phone, dni, is_verified_dni, created_at')
        .single();

      if (updateError) {
        console.error('❌ [UPDATE PROFILE] Error al actualizar:', updateError);
        return res.status(500).json({ 
          error: 'Error al actualizar el perfil',
          code: 'UPDATE_FAILED'
        });
      }

      if (!updatedUser) {
        console.error('❌ [UPDATE PROFILE] Usuario no encontrado');
        return res.status(404).json({ 
          error: 'Usuario no encontrado'
        });
      }

      console.log('✅ [UPDATE PROFILE] Perfil actualizado exitosamente');

      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        user: updatedUser
      });
    } catch (error) {
      console.error('❌ [UPDATE PROFILE] Error interno:', error);
      res.status(500).json({ 
        error: 'Error al actualizar el perfil',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * ✨ BONUS: Verificar disponibilidad de DNI
   * 
   * Útil si en el futuro quieres permitir cambiar el DNI
   * y necesitas verificar que no esté ya registrado por otro usuario
   */
  async checkDniAvailability(req: AuthRequest, res: Response) {
    try {
      const { dni } = req.query;
      const user_id = req.user!.id;

      if (!dni || typeof dni !== 'string') {
        return res.status(400).json({ 
          error: 'DNI es requerido'
        });
      }

      // Buscar si existe otro usuario con ese DNI
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('id')
        .eq('dni', dni)
        .neq('id', user_id) // Excluir al usuario actual
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no encontrado
        console.error('Error verificando DNI:', error);
        return res.status(500).json({ 
          error: 'Error al verificar DNI'
        });
      }

      const isAvailable = !existingUser;

      res.json({
        available: isAvailable,
        message: isAvailable 
          ? 'DNI disponible' 
          : 'Este DNI ya está registrado por otro usuario'
      });
    } catch (error) {
      console.error('Error en checkDniAvailability:', error);
      res.status(500).json({ 
        error: 'Error interno',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}