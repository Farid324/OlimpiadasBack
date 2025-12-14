import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailer: MailerService) {}

  async sendEvaluatorWelcomeEmail(
    email: string,
    nombre: string,
    tempPassword: string,
  ) {
    try {
      await this.mailer.sendMail({
        to: email,
        subject: 'Bienvenido al Sistema de Olimpiadas - Evaluador',
        text: `Hola ${nombre},

Bienvenido al sistema de gestión de Olimpiadas.

Tu cuenta ha sido creada.
Puedes iniciar sesión con:
  Correo: ${email}
  Contraseña temporal: ${tempPassword}

Se recomienda cambiar tu contraseña después de iniciar sesión.

Saludos,
Equipo Organizador Oh! SanSi`,
        html: `
          <p>Hola <strong>${nombre}</strong>,</p>
          <p>Bienvenido al sistema de gestión de Olimpiadas.</p>
          <p><b>Tu cuenta ha sido creada.</b></p>
          <p>Puedes iniciar sesión con:</p>
          <ul>
            <li><b>Correo:</b> ${email}</li>
            <li><b>Contraseña temporal:</b> ${tempPassword}</li>
          </ul>
          <p>Se recomienda cambiar tu contraseña después de iniciar sesión.</p>
          <p>Saludos,<br/>Equipo Organizador Oh! SanSi</p>
        `,
      });

      this.logger.log(`Correo de bienvenida enviado a ${email}`);
      return { ok: true };
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(`Error al enviar correo a ${email}`, err.stack);
      } else {
        this.logger.error(`Error al enviar correo a ${email}: ${String(err)}`);
      }
      // En este caso, sí lanzamos el error para que el servicio que lo llamó se entere
      throw err;
    }
  }

  // Esta es la implementación que conservamos.
  // La definición duplicada que solo lanzaba error ha sido eliminada.
  async sendResponsableWelcomeEmail(
    email: string,
    nombre: string,
    tempPassword: string, // CI
  ) {
    try {
      await this.mailer.sendMail({
        to: email,
        subject: 'Bienvenido al Sistema de Olimpiadas - Responsable de Área',
        text: `Hola ${nombre},\n\nBienvenido al sistema de gestión de Olimpiadas.\n\nTu cuenta como Responsable de Área ha sido creada.\nPuedes iniciar sesión con:\n Correo: ${email}\n Contraseña temporal: ${tempPassword}\n\nSe recomienda cambiar tu contraseña después de iniciar sesión.\n\nSaludos,\nEquipo Organizador Oh! SanSi`,
        html: `
          <p>Hola <strong>${nombre}</strong>,</p>
          <p>Bienvenido al sistema de gestión de Olimpiadas.</p>
          <p><b>Tu cuenta como Responsable de Área ha sido creada.</b></p>
          <p>Puedes iniciar sesión con:</p>
          <ul>
            <li><b>Correo:</b> ${email}</li>
            <li><b>Contraseña temporal:</b> ${tempPassword}</li>
          </ul>
          <p>Se recomienda cambiar tu contraseña después de iniciar sesión.</p>
          <p>Saludos,<br/>Equipo Organizador Oh! SanSi</p>
        `,
      });
      this.logger.log(`Correo de bienvenida (Responsable) enviado a ${email}`);
      return { ok: true };
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(
          `Error al enviar correo (Responsable) a ${email}`,
          err.stack,
        );
      } else {
        this.logger.error(
          `Error al enviar correo (Responsable) a ${email}: ${String(err)}`,
        );
      }
      // Como dice tu comentario, aquí no lanzamos el error
      // para no bloquear el flujo principal (ej. la creación del usuario).
      return { ok: false, error: err };
    }
  }
}
