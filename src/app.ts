import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Importación de rutas
import authRoutes from './routes/auth.routes';
import roomRoutes from './routes/room.routes';
import reservationRoutes from './routes/reservation.routes';
import paymentRoutes from './routes/payment.routes';
import userRoutes from './routes/user.routes';
import reniecRoutes from './routes/reniec.routes'; // Asegúrate que este archivo exista en routes/
import serviceRoutes from './routes/service.routes';
import discountRoutes from './routes/discount.routes';
import adminRoutes from './routes/admin.routes';

dotenv.config();

const app = express();

// --- CONFIGURACIÓN CORS (Permitir todo) ---
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// ------------------------------------------

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json());

// Definición de Rutas
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/reservations', reservationRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/integrations/reniec', reniecRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/discounts', discountRoutes);
app.use('/api/v1/admin', adminRoutes);

// Ruta de prueba para ver si el servidor vive
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando correctamente 🚀' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;