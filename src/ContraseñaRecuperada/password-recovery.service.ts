import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcryptjs';
import { RecoverByDataDto } from './dto/recover-by-data.dto';
import { RecoverByEmailDto } from './dto/recover-by-email.dto';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService, // 👈 IMPORTANTÍSIMO
  ) {}

  // Normalizar nombres
  private normalizeName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private async hashPassword(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
  }

  private generateTempPassword(length = 10): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < length; i += 1) {
      const idx = Math.floor(Math.random() * chars.length);
      result += chars[idx];
    }
    return result;
  }

  // =============================================
  // 📧 ENVÍO REAL DE CONTRASEÑA TEMPORAL AL CORREO
  // =============================================
  private async sendTemporaryPasswordEmail(
    email: string,
    tempPassword: string,
  ): Promise<void> {
    try {
      await this.mailer.sendMail({
        to: email,
        subject: 'Recuperación de contraseña - Oh! SanSi',
        text: `Tu nueva contraseña temporal es: ${tempPassword}`,
        html: `
          <p>Hola,</p>
          <p>Hemos recibido una solicitud de <strong>recuperación de contraseña</strong>.</p>
          <p>Tu nueva contraseña temporal es:</p>
          <h2>${tempPassword}</h2>
          <p>Por seguridad, cámbiala después de iniciar sesión.</p>
          <br/>
          <p>Equipo Oh! SanSi</p>
        `,
      });

      this.logger.log(`Correo enviado correctamente a ${email}`);
    } catch (err) {
      this.logger.error(`Error enviando correo a ${email}`, err);
    }
  }

  // =============================================
  // 🔹 OPCIÓN 1: Validación por datos → contraseña = CI
  // =============================================
  async recoverByData(dto: RecoverByDataDto): Promise<{ message: string }> {
    const normalizedFullName = this.normalizeName(dto.fullName);

    const usuario = await this.prisma.usuarios.findFirst({
      where: {
        correo: dto.email,
        ci: dto.ci,
        activo: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('No se encontraron datos que coincidan.');
    }

    const dbFullName = `${usuario.nombre} ${usuario.apellido ?? ''}`;
    const normalizedDbName = this.normalizeName(dbFullName);

    if (normalizedDbName !== normalizedFullName) {
      throw new NotFoundException('No se encontraron datos que coincidan.');
    }

    const newHash = await this.hashPassword(dto.ci);

    await this.prisma.usuarios.update({
      where: { id_usuario: usuario.id_usuario },
      data: { hash_password: newHash },
    });

    return { message: 'Tu contraseña ha sido actualizada a tu CI actual.' };
  }

  // =============================================
  // 🔹 OPCIÓN 2: Recuperación por correo
  // =============================================
  async recoverByEmail(dto: RecoverByEmailDto): Promise<{ message: string }> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { correo: dto.email },
    });

    if (!usuario || !usuario.activo) {
      throw new NotFoundException(
        'No se encontró una cuenta asociada a ese correo.',
      );
    }

    const tempPassword = this.generateTempPassword();
    const newHash = await this.hashPassword(tempPassword);

    await this.prisma.usuarios.update({
      where: { id_usuario: usuario.id_usuario },
      data: { hash_password: newHash },
    });

    // 📧 ENVÍO DEL CORREO
    await this.sendTemporaryPasswordEmail(dto.email, tempPassword);

    return {
      message:
        'Se ha enviado una contraseña temporal a tu correo. Revisa tu bandeja de entrada.',
    };
  }
}
