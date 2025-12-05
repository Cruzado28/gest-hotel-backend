import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export class AuthController {
  async googleLogin(req: Request, res: Response) {
    try {
      const { id_token } = req.body;

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: id_token
      });

      if (error) {
        return res.status(401).json({ error: error.message });
      }

      // Verificar/crear usuario
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!existingUser) {
        await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
          role: 'user',
          is_verified_dni: false
        });
      }

      // Obtener usuario actualizado
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      res.json({
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        user: userData
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async getCurrentUser(req: any, res: Response) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.user.id)
        .single();

      if (error) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
}