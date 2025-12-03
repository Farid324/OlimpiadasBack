// src/NewPassword/new-password.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service'; // ⚠️ ajusta la ruta si tu PrismaService está en otro lado

@Injectable()
export class NewPasswordService {
  constructor(private readonly prisma: PrismaService) {}

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    // 1. Buscar usuario por id_usuario
    const user = await this.prisma.usuarios.findUnique({
      where: { id_usuario: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // 2. Verificar contraseña actual
    const ok = await bcrypt.compare(currentPassword, user.hash_password);
    if (!ok) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    // 3. Hashear la nueva contraseña
    const saltRounds = 10;
    const hashed = await bcrypt.hash(newPassword, saltRounds);

    // 4. Actualizar hash_password
    await this.prisma.usuarios.update({
      where: { id_usuario: userId },
      data: {
        hash_password: hashed,
      },
    });

    return { message: 'Contraseña actualizada correctamente.' };
  }
}
