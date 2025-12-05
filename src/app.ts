import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import roomRoutes from './routes/room.routes';
import reservationRoutes from './routes/reservation.routes';
import paymentRoutes from './routes/payment.routes';
import reniecRoutes from './routes/reniec.routes';
import userRoutes from './routes/user.routes';
import serviceRoutes from './routes/service.routes';
import discountRoutes from './routes/discount.routes';
import adminRoutes from './routes/admin.routes';

dotenv.config();

const app = express();

// --- CAMBIO IMPORTANTE AQUÍ ---
app.use(cors({
  origin: '*', // Deja entrar a TODOS (Vercel, Postman, etc.)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
  // credentials: true <--- ESTO LO QUITAMOS porque choca con el '*'
}));
// ------------------------------

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/reservations', reservationRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/integrations/reniec', reniecRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/discounts', discountRoutes);
app.use('/api/v1/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;