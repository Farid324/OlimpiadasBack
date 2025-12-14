// src/auth/services/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { compare } from '../../common/utils/hash.util';
import type { JwtPayload } from '../../interfaces/jwt-payload.interface';
import type { LoginResult, RoleName } from '../dto/login-result.dto';

@Injectable()
export class AuthService {
  jwtService: any;
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

    const role: RoleName = u.rol.nombre as RoleName;

    // 🔹 Solo para RESPONSABLE_DE_AREA y EVALUADOR verificamos gestión actual
    const requiereGestion =
      role === 'RESPONSABLE_DE_AREA' || role === 'EVALUADOR';

    if (requiereGestion) {
      const gestionAbierta = await this.prisma.gestiones.findFirst({
        where: { estado: 'ABIERTA' },
        select: { id_gestion: true },
      });

      if (!gestionAbierta) {
        throw new UnauthorizedException(
          'No existe una gestión abierta para este rol. Consulte con coordinación.',
        );
      }

      if (role === 'RESPONSABLE_DE_AREA') {
        const vinculoResp = await this.prisma.responsables_area.findFirst({
          where: {
            id_usuario: u.id_usuario,
            id_gestion: gestionAbierta.id_gestion,
            activo: true,
          },
          select: { id_responsable_area: true },
        });

        if (!vinculoResp) {
          throw new UnauthorizedException(
            'Usuario no habilitado para la gestión actual. Debe ser registrado como responsable en la gestión vigente.',
          );
        }
      }

      if (role === 'EVALUADOR') {
        const vinculoEval = await this.prisma.evaluadores_area.findFirst({
          where: {
            id_usuario: u.id_usuario,
            id_gestion: gestionAbierta.id_gestion,
            activo: true,
          },
          select: { id_evaluador_area: true },
        });

        if (!vinculoEval) {
          throw new UnauthorizedException(
            'Usuario no habilitado para la gestión actual. Debe ser registrado como evaluador en la gestión vigente.',
          );
        }
      }
    }

    const payload: JwtPayload = {
      sub: String(u.id_usuario),
      email: u.correo,
      role,
      roleId: String(u.id_rol),
    };

    const access_token = `${await this.jwt.signAsync(payload)}`;

    return {
      access_token,
      user: {
        id: String(u.id_usuario),
        email: u.correo,
        name: `${u.nombre} ${u.apellido}`,
        role,
      },
    };
  }
}
