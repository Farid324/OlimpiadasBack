// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  me(id: bigint) {
    return this.prisma.usuarios.findUnique({
      where: { id_usuario: id },
      select: {
        id_usuario: true,
        correo: true,
        nombre: true,
        apellido: true,
        rol: { select: { nombre: true } },
      },
    });
  }
}
