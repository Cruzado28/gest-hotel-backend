import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = async (  // ← ✅ CAMBIO: Era "authenticate", ahora es "authMiddleware"
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('🔐 [AUTH] Authorization header:', authHeader ? 'Presente' : '❌ Ausente');
    console.log('🔐 [AUTH] Path:', req.method, req.path);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [AUTH] No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    console.log('🎫 [AUTH] Token:', token.substring(0, 30) + '...');

    // 🔧 MOCK USER - Para desarrollo
    if (token === 'mock-token') {
      console.log('🧪 [AUTH] Usando MOCK USER');
      req.user = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test@example.com',
        role: 'user'
      };
      return next();
    }

    console.log('🔍 [AUTH] Verificando token con Supabase...');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error('❌ [AUTH] Error de Supabase:', error.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!user) {
      console.error('❌ [AUTH] Usuario no encontrado');
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('✅ [AUTH] Usuario encontrado:', user.email);

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    req.user = {
      id: user.id,
      email: user.email!,
      role: userData?.role || 'user'
    };

    console.log('✅ [AUTH] Autenticación exitosa:', req.user.email);
    next();
  } catch (error) {
    console.error('❌ [AUTH] Error inesperado:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
