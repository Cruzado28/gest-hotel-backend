import nodemailer from 'nodemailer';
import { supabase } from '../config/supabase';
import { PDFService } from './pdf.service';

export class EmailService {
  private transporter;
  private pdfService: PDFService;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
    this.pdfService = new PDFService();
  }

  async sendReservationConfirmation(reservationId: string) {
    try {
      // Obtener datos completos de la reserva CON payments
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select(`
          *,
          users (
            id,
            email,
            name,
            phone,
            dni
          ),
          rooms (
            code,
            type,
            description,
            price_per_night
          ),
          payments (
            id,
            method,
            status,
            transaction_ref
          )
        `)
        .eq('id', reservationId)
        .single();

      if (error || !reservation) {
        throw new Error('Reserva no encontrada');
      }

      const user = reservation.users;
      const room = reservation.rooms;

      // 🆕 Generar PDF usando TU servicio (que ya sube a Supabase)
      console.log('📄 Generando PDF...');
      const pdfUrl = await this.pdfService.generateReservationPDF(reservation as any);
      console.log('📎 PDF generado y subido:', pdfUrl);

      // Formatear fechas
      const checkIn = new Date(reservation.check_in).toLocaleDateString('es-PE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const checkOut = new Date(reservation.check_out).toLocaleDateString('es-PE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // HTML del email
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #2563eb;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .logo {
              max-width: 200px;
              margin-bottom: 10px;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .info-box {
              background-color: #f3f4f6;
              padding: 15px;
              border-radius: 6px;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .label {
              font-weight: bold;
              color: #4b5563;
            }
            .value {
              color: #1f2937;
            }
            .total {
              font-size: 24px;
              color: #2563eb;
              font-weight: bold;
              text-align: center;
              margin: 20px 0;
            }
            .download-btn {
              display: inline-block;
              background-color: #2563eb;
              color: white !important;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px auto;
              text-align: center;
            }
            .btn-container {
              text-align: center;
              margin: 30px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${process.env.HOTEL_LOGO_URL}" alt="Hotel Los Andes" class="logo" />
              <h1>🎉 ¡Reserva Confirmada!</h1>
              <p>${process.env.HOTEL_NAME || 'Hotel Los Andes'}</p>
            </div>
            
            <div class="content">
              <p>Estimado/a <strong>${user.name}</strong>,</p>
              
              <p>Su reserva ha sido confirmada exitosamente. A continuación encontrará los detalles:</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #2563eb;">📋 Detalles de la Reserva</h3>
                
                <div class="info-row">
                  <span class="label">N° de Reserva:</span>
                  <span class="value">${reservation.id.substring(0, 8).toUpperCase()}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">Habitación:</span>
                  <span class="value">${room.code} - ${room.type}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">Check-in:</span>
                  <span class="value">${checkIn}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">Check-out:</span>
                  <span class="value">${checkOut}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">Huéspedes:</span>
                  <span class="value">${reservation.guests} persona(s)</span>
                </div>
              </div>
              
              <div class="total">
                Total Pagado: S/ ${reservation.total_amount.toFixed(2)}
              </div>

              <div class="btn-container">
                <a href="${pdfUrl}" class="download-btn" target="_blank">
                  📄 Descargar Comprobante PDF
                </a>
              </div>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #2563eb;">ℹ️ Información Importante</h3>
                <ul>
                  <li><strong>Hora de check-in:</strong> A partir de las 14:00 horas</li>
                  <li><strong>Hora de check-out:</strong> Hasta las 12:00 horas</li>
                  <li><strong>Cancelación:</strong> Puede cancelar hasta 48 horas antes sin cargo</li>
                  <li><strong>Documento:</strong> Recuerde traer su DNI o documento de identidad</li>
                </ul>
              </div>
              
              <p><strong>¿Necesita ayuda?</strong></p>
              <p>
                📧 Email: ${process.env.HOTEL_EMAIL || 'info@hotellosandes.com'}<br>
                📞 Teléfono: ${process.env.HOTEL_PHONE || '+51 123 456 789'}
              </p>
              
              <div class="footer">
                <p>Gracias por elegir ${process.env.HOTEL_NAME || 'Hotel Los Andes'}</p>
                <p>${process.env.HOTEL_ADDRESS || 'Av. Principal 123, Moche, La Libertad, Perú'}</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Enviar email (sin PDF adjunto, solo link de descarga)
      const info = await this.transporter.sendMail({
        from: `"${process.env.HOTEL_NAME || 'Hotel Los Andes'}" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: `✅ Confirmación de Reserva - ${reservation.id.substring(0, 8).toUpperCase()}`,
        html: htmlContent
      });

      console.log('✅ Email enviado:', info.messageId);
      return { messageId: info.messageId, pdfUrl };
    } catch (error) {
      console.error('Error en sendReservationConfirmation:', error);
      throw error;
    }
  }
}