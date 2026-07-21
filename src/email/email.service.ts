import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.fromEmail = this.configService.get<string>(
      'EMAIL_FROM',
      'onboarding@resend.dev',
    );
  }

  async sendWelcomeEmail(to: string, firstName: string) {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: '¡Bienvenido a Ecommerce Portfolio!',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>¡Hola, ${firstName}!</h1>
            <p>Gracias por registrarte en nuestra tienda. Tu cuenta ya está lista para usarse.</p>
            <p>Empieza a explorar nuestro catálogo cuando quieras.</p>
          </div>
        `,
      });
      this.logger.log(`Email de bienvenida enviado a ${to}`);
    } catch (error) {
      this.logger.error(`Error enviando email de bienvenida a ${to}`, error);
    }
  }

  async sendOrderConfirmationEmail(
    to: string,
    firstName: string,
    orderId: string,
    totalAmount: number,
    items: { productName: string; quantity: number; price: number }[],
  ) {
    const itemsHtml = items
      .map(
        (item) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.productName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toLocaleString('es-CO')}</td>
          </tr>
        `,
      )
      .join('');

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `Confirmación de tu pedido #${orderId.slice(0, 8)}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>¡Gracias por tu compra, ${firstName}!</h1>
            <p>Tu pedido <strong>#${orderId.slice(0, 8)}</strong> ha sido recibido y está siendo procesado.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 8px; text-align: left;">Producto</th>
                  <th style="padding: 8px; text-align: center;">Cantidad</th>
                  <th style="padding: 8px; text-align: right;">Precio</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            <p style="font-size: 18px; text-align: right;">
              <strong>Total: $${totalAmount.toLocaleString('es-CO')}</strong>
            </p>
          </div>
        `,
      });
      this.logger.log(`Email de confirmación de orden enviado a ${to}`);
    } catch (error) {
      this.logger.error(`Error enviando email de orden a ${to}`, error);
    }
  }

  async sendLowStockAlert(
    to: string,
    variants: { sku: string; productName: string; stock: number }[],
  ) {
    const itemsHtml = variants
      .map(
        (v) =>
          `<li>${v.productName} (${v.sku}): ${v.stock} unidades restantes</li>`,
      )
      .join('');

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: 'Alerta: productos con bajo stock',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Alerta de inventario</h1>
            <p>Las siguientes variantes tienen bajo stock:</p>
            <ul>${itemsHtml}</ul>
          </div>
        `,
      });
      this.logger.log(`Alerta de bajo stock enviada a ${to}`);
    } catch (error) {
      this.logger.error(`Error enviando alerta de bajo stock a ${to}`, error);
    }
  }

  async sendPasswordResetEmail(
    to: string,
    firstName: string,
    resetUrl: string,
  ) {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: 'Recupera tu contraseña',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Hola, ${firstName}</h1>
            <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace para continuar:</p>
            <p>
              <a href="${resetUrl}" style="display: inline-block; background: #0F6E5C; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                Restablecer contraseña
              </a>
            </p>
            <p>Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
          </div>
        `,
      });
      this.logger.log(`Email de recuperación enviado a ${to}`);
    } catch (error) {
      this.logger.error(`Error enviando email de recuperación a ${to}`, error);
    }
  }
}
