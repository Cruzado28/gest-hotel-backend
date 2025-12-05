import PDFDocument from 'pdfkit';
import { supabase } from '../config/supabase';
import * as path from 'path';
import * as fs from 'fs';

interface ReservationData {
  id: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_amount: number;
  guest_details: any;
  created_at: string;
  rooms: {
    code: string;
    type: string;
    description: string;
    price_per_night: number;
  };
  users: {
    name: string;
    email: string;
    phone: string;
    dni: string;
  };
  payments: any[];
  services?: any[];
  discounts?: any[];
}

export class PDFService {
  async generateReservationPDF(reservationData: ReservationData): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', async () => {
          try {
            const pdfBuffer = Buffer.concat(chunks);
            const fileName = `reservations/${reservationData.id}.pdf`;

            const { error: uploadError } = await supabase.storage
              .from('pdfs')
              .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true
              });

            if (uploadError) {
              reject(new Error(`Error: ${uploadError.message}`));
              return;
            }

            const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(fileName);

            await supabase.from('pdf_storage').insert({
              reservation_id: reservationData.id,
              file_path: fileName,
              file_size: pdfBuffer.length
            });

            resolve(urlData.publicUrl);
          } catch (err) {
            reject(err);
          }
        });

        const logoPath = path.join(__dirname, '../assets/logo.png');
        let y = 50;

        // Header con logo más grande
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, y, { width: 70, height: 70 });
        }
        
        doc.fontSize(28).fillColor('#4A90E2').text('Hotel Los Andes', 130, y + 15);
        doc.fontSize(11).fillColor('#6b7280')
          .text('Av. Principal 123, Moche, La Libertad, Perú | Tel: +51 123 456 789', 130, y + 48);

        y += 90;
        doc.moveTo(50, y).lineTo(545, y).lineWidth(2).stroke('#4A90E2');

        // Título y estado
        y += 20;
        doc.fontSize(20).fillColor('#111827').text('COMPROBANTE DE RESERVA', 50, y);
        
        const payment = reservationData.payments?.[0];
        const estado = payment?.status === 'success' ? 'CONFIRMADA' : 'PENDIENTE';
        doc.fontSize(14).fillColor(payment?.status === 'success' ? '#10b981' : '#f59e0b')
          .text(estado, 440, y);

        y += 30;
        doc.fontSize(11).fillColor('#6b7280')
          .text(`Reserva: ${reservationData.id.substring(0, 8).toUpperCase()}`, 50, y)
          .text(`Fecha: ${new Date(reservationData.created_at).toLocaleDateString('es-PE')}`, 380, y);

        // Datos del Huésped y Habitación en dos columnas
        y += 35;
        doc.fontSize(14).fillColor('#4A90E2').text('DATOS DEL HUÉSPED', 50, y);
        doc.fontSize(14).fillColor('#4A90E2').text('DETALLES DE LA HABITACIÓN', 320, y);

        y += 25;
        const leftCol = 50;
        const rightCol = 320;

        // Columna izquierda - Huésped
        doc.fontSize(11).fillColor('#374151')
          .text('Nombre:', leftCol, y)
          .text(reservationData.users.name || reservationData.guest_details.name, leftCol + 70, y, { width: 180 });
        
        y += 18;
        doc.text('Email:', leftCol, y)
          .text(reservationData.users.email, leftCol + 70, y, { width: 180 });
        
        y += 18;
        doc.text('Teléfono:', leftCol, y)
          .text(reservationData.users.phone || reservationData.guest_details.phone, leftCol + 70, y);
        
        y += 18;
        doc.text('DNI:', leftCol, y)
          .text(reservationData.users.dni || reservationData.guest_details.dni, leftCol + 70, y);

        // Columna derecha - Habitación
        let yRight = y - 54;
        doc.text('Habitación:', rightCol, yRight)
          .text(`${reservationData.rooms.code} - ${this.getRoomTypeName(reservationData.rooms.type)}`, rightCol + 75, yRight, { width: 150 });
        
        yRight += 18;
        doc.text('Descripción:', rightCol, yRight)
          .text(reservationData.rooms.description, rightCol + 75, yRight, { width: 150 });

        yRight += 36;
        const nights = this.calculateNights(reservationData.check_in, reservationData.check_out);
        
        // Usar directamente las fechas sin parsear
        const checkInDate = reservationData.check_in.split('T')[0];
        const checkOutDate = reservationData.check_out.split('T')[0];
        
        doc.text('Check-in:', rightCol, yRight)
          .text(this.formatDate(checkInDate), rightCol + 75, yRight);

        yRight += 18;
        doc.text('Check-out:', rightCol, yRight)
          .text(this.formatDate(checkOutDate), rightCol + 75, yRight);

        yRight += 18;
        doc.text('Noches:', rightCol, yRight)
          .text(nights.toString(), rightCol + 75, yRight);
        
        yRight += 18;
        doc.text('Huéspedes:', rightCol, yRight)
          .text(reservationData.guests.toString(), rightCol + 75, yRight);

        // Resumen de Pago
        y = Math.max(y + 25, yRight + 25);
        doc.fontSize(14).fillColor('#4A90E2').text('RESUMEN DE PAGO', 50, y);

        y += 25;
        const roomSubtotal = reservationData.rooms.price_per_night * nights;
        doc.fontSize(11).fillColor('#374151');
        
        doc.text('Habitación:', 50, y);
        doc.text(`S/ ${reservationData.rooms.price_per_night.toFixed(2)} × ${nights}`, 350, y, { width: 100, align: 'right' });
        doc.text(`S/ ${roomSubtotal.toFixed(2)}`, 455, y, { width: 90, align: 'right' });

        // Servicios
        if (reservationData.services && reservationData.services.length > 0) {
          y += 25;
          doc.fontSize(12).fillColor('#4A90E2').text('Servicios adicionales:', 50, y);
          reservationData.services.forEach((service: any) => {
            y += 16;
            doc.fontSize(11).fillColor('#374151');
            doc.text(`• ${service.services?.name} × ${service.quantity}`, 50, y);
            doc.text(`S/ ${service.subtotal.toFixed(2)}`, 455, y, { width: 90, align: 'right' });
          });
        }

        // Descuentos
        if (reservationData.discounts && reservationData.discounts.length > 0) {
          y += 25;
          doc.fontSize(12).fillColor('#059669').text('Descuentos:', 50, y);
          reservationData.discounts.forEach((discount: any) => {
            y += 16;
            doc.fontSize(11).fillColor('#059669');
            doc.text(`• ${discount.discounts?.code}`, 50, y);
            doc.text(`- S/ ${discount.discount_amount.toFixed(2)}`, 455, y, { width: 90, align: 'right' });
          });
        }

        // Línea divisoria
        y += 25;
        doc.moveTo(50, y).lineTo(545, y).lineWidth(2).stroke('#e5e7eb');

        // Total
        y += 18;
        doc.fontSize(18).fillColor('#4A90E2');
        doc.text('TOTAL:', 50, y);
        doc.text(`S/ ${reservationData.total_amount.toFixed(2)}`, 455, y, { width: 90, align: 'right' });

        if (payment) {
          y += 25;
          doc.fontSize(10).fillColor('#6b7280')
            .text(`Método de pago: ${payment.method.toUpperCase()} | Referencia: ${payment.transaction_ref}`, 50, y);
        }

        // Términos y Condiciones
        y += 35;
        doc.fontSize(12).fillColor('#4A90E2').text('INFORMACIÓN IMPORTANTE', 50, y);
        
        y += 20;
        doc.fontSize(10).fillColor('#374151');
        
        const terms = [
          '• Check-in disponible a partir de las 14:00 hrs',
          '• Check-out hasta las 12:00 hrs',
          '• Presentar DNI original al momento del check-in',
          '• Cancelación gratuita hasta 24 horas antes del check-in',
          '• Política de no fumadores en todas las habitaciones',
          '• Consultas: info@hotellosandes.com | +51 123 456 789'
        ];

        terms.forEach((term) => {
          doc.text(term, 50, y);
          y += 16;
        });

        // Footer
        y += 20;
        doc.moveTo(50, y).lineTo(545, y).lineWidth(1).stroke('#e5e7eb');
        
        y += 15;
        doc.fontSize(12).fillColor('#4A90E2')
          .text('¡Gracias por elegir Hotel Los Andes!', 50, y, { align: 'center', width: 495 });
        
        y += 18;
        doc.fontSize(10).fillColor('#6b7280')
          .text('Esperamos que disfrutes tu estadía en el corazón de los Andes', 50, y, { align: 'center', width: 495 });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private formatDate(dateString: string): string {
    // dateString viene como "2025-11-27"
    const parts = dateString.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  private getRoomTypeName(type: string): string {
    const types: Record<string, string> = {
      single: 'Individual',
      double: 'Doble',
      suite: 'Suite Ejecutiva'
    };
    return types[type] || type;
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    // Usar solo la parte de la fecha sin conversión a Date
    const checkInDate = checkIn.split('T')[0];
    const checkOutDate = checkOut.split('T')[0];
    
    const [y1, m1, d1] = checkInDate.split('-').map(Number);
    const [y2, m2, d2] = checkOutDate.split('-').map(Number);
    
    const date1 = new Date(y1, m1, d1, 12, 0, 0);
    const date2 = new Date(y2, m2, d2, 12, 0, 0);
    
    return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
  }
}