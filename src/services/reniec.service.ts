import api from './api';

export interface ReniecVerifyResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    dni: string;
    birthdate: string;
    age: number;
    is_verified_dni: boolean;
  };
  user?: any;
  age?: number;
  isAdult?: boolean;
}

class ReniecService {
  async verifyDNI(dni: string, birthdate: string): Promise<ReniecVerifyResponse> {
    console.log('🔍 [RENIEC SERVICE] Verificando DNI:', dni, 'Fecha:', birthdate);
    
    try {
      const response = await api.post<ReniecVerifyResponse>(
        '/api/v1/integrations/reniec/verify',
        { dni, birthdate }
      );

      console.log('✅ [RENIEC SERVICE] Respuesta exitosa:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [RENIEC SERVICE] Error:', error.response?.data);
      throw error;
    }
  }
}

export const reniecService = new ReniecService();