// src/auth/services/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { compare } from '../../common/utils/hash.util';
import type { JwtPayload } from '../../interfaces/jwt-payload.interface';
import type { LoginResult, RoleName } from '../dto/login-result.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.usuarios.findUnique({
      where: { correo: email },
      include: { rol: true },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok: boolean = await compare(password, user.hash_password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    return user;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const u = await this.validateUser(email, password);

    const roleName: RoleName = u.rol.nombre as RoleName;

    const payload = {
      sub: String(u.id_usuario),
      email: u.correo,
      roleId: String(u.id_rol),
      roleName,
    } satisfies JwtPayload;

    const access_token = `${await this.jwt.signAsync(payload)}`;

    return {
      access_token,
      user: {
        id: String(u.id_usuario),
        email: u.correo,
        name: `${u.nombre} ${u.apellido}`,
        role: roleName,
      },
    };
  }
}
