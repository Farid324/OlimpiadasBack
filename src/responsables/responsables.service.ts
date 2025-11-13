//src/responsables/responsables.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResponsableDto } from './dto/create-responsable.dto';
import { UpdateResponsableDto } from './dto/update-responsable.dto';
import { FilterResponsableDto } from './dto/filter-responsable.dto';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// --- HELPERS DE TUS AMIGOS (Manejo de errores) ---
function isKnownPrismaError(e: unknown): e is PrismaClientKnownRequestError {
  return e instanceof PrismaClientKnownRequestError;
}

function hasCodeMeta(
  e: unknown,
): e is { code: string | number; meta?: Record<string, unknown> } {
  return typeof e === 'object' && e !== null && 'code' in e;
}

function hasHttpResponseMessage(
  e: unknown,
): e is { response: { message?: string | string[] } } {
  if (typeof e !== 'object' || e === null || !('response' in e)) return false;
  const r = (e as { response?: unknown }).response;
  return typeof r === 'object' && r !== null;
}

function errorToLog(e: unknown) {
  if (isKnownPrismaError(e)) {
    return { name: e.name, code: e.code, message: e.message, meta: e.meta };
  }
  if (e instanceof Error) return { name: e.name, message: e.message };
  return { value: String(e) };
}

function formatPrismaError(err: unknown): string {
  if (isKnownPrismaError(err)) {
    const metaObj = err.meta ?? {};
    const targetRaw = (metaObj as { target?: unknown }).target;
    const metaStr =
      Object.keys(metaObj).length > 0
        ? ` | meta: ${JSON.stringify(metaObj)}`
        : '';

    switch (err.code) {
      case 'P2002': {
        const target = Array.isArray(targetRaw)
          ? (targetRaw as string[])
          : ['campo único'];
        return `Duplicado en ${target.join(', ')}`;
      }
      case 'P2003':
        return `Violación de clave foránea${metaStr}`;
      case 'P2000':
        return `Valor demasiado largo para un campo${metaStr}`;
      case 'P2011':
        return `Hay un campo obligatorio sin valor${metaStr}`;
      case 'P2025':
        return `Registro relacionado no encontrado${metaStr}`;
      default:
        return `Error Prisma ${err.code}${metaStr}`;
    }
  }

  if (hasCodeMeta(err)) {
    const code = String(err.code);
    const metaObj = err.meta ?? {};
    const metaStr =
      Object.keys(metaObj).length > 0
        ? ` | meta: ${JSON.stringify(metaObj)}`
        : '';
    return `Error Prisma ${code}${metaStr}`;
  }

  if (hasHttpResponseMessage(err)) {
    const msg = (err as { response: { message?: string | string[] } }).response
      .message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }

  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}

@Injectable()
export class ResponsablesService {
  private readonly logger = new Logger(ResponsablesService.name);
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Helper privado para buscar rol (De tus amigos)
  private async getResponsableRoleId(): Promise<number> {
    try {
      const rol = await this.prisma.roles.findUnique({
        where: { nombre: 'RESPONSABLE_DE_AREA' },
        select: { id_rol: true },
      });
      if (!rol?.id_rol) {
        throw new NotFoundException('Rol "RESPONSABLE_DE_AREA" no encontrado.');
      }
      return rol.id_rol;
    } catch (e) {
      this.logger.error(
        'Error al buscar el rol RESPONSABLE_DE_AREA',
        e instanceof Error ? e.stack : e,
      );
      throw new BadRequestException(
        `Error interno al buscar rol: ${formatPrismaError(e)}`,
      );
    }
  }

  async create(dto: CreateResponsableDto) {
    try {
      // 1. Validar duplicados (TU LOGICA + LOGGING AMIGOS)
      const exists = await this.prisma.usuarios.findFirst({
        where: {
          OR: [
            { correo: dto.correo },
            { ci: dto.ci },
            { telefono: dto.telefono },
          ],
        },
      });

      if (exists) {
        if (exists.correo === dto.correo)
          throw new BadRequestException('El correo ya está registrado');
        if (exists.ci === dto.ci)
          throw new BadRequestException('El CI ya está registrado');
        if (exists.telefono === dto.telefono)
          throw new BadRequestException('El teléfono ya está registrado');
      }

      // 2. Validar Área Ocupada (TU LOGICA RESTAURADA)
      // Tus amigos habían borrado esto, es crítico para que no haya 2 responsables activos.
      const ocupada = await this.prisma.responsables_area.findFirst({
        where: { id_area: dto.id_area, activo: true },
      });
      if (ocupada) {
        throw new BadRequestException(
          'El área ya tiene un responsable asignado',
        );
      }

      // 3. Preparar datos (LÓGICA AMIGOS: CI es password + Rol dinámico)
      if (!dto.ci || !dto.ci.trim()) {
        throw new BadRequestException(
          'El CI es obligatorio para la contraseña inicial.',
        );
      }
      const tempPassword = dto.ci.trim();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const idRolResponsable = await this.getResponsableRoleId();

      // 4. Crear Usuario y Relación
      const usuario = await this.prisma.usuarios.create({
        data: {
          nombre: dto.nombre,
          apellido: dto.apellido,
          correo: dto.correo,
          hash_password: hashedPassword,
          telefono: dto.telefono,
          institucion: dto.institucion,
          experiencia: dto.experiencia,
          especialidad: dto.especialidad,
          ci: dto.ci,
          rol: { connect: { id_rol: idRolResponsable } },
        },
        select: { id_usuario: true, nombre: true, correo: true },
      });

      await this.prisma.responsables_area.create({
        data: {
          id_usuario: usuario.id_usuario,
          id_area: dto.id_area,
          // activo: true (default por prisma schema usualmente)
        },
      });

      // 5. Enviar Correo (LÓGICA AMIGOS)
      this.emailService
        .sendResponsableWelcomeEmail(
          usuario.correo,
          usuario.nombre,
          tempPassword,
        )
        .catch((emailError) => {
          this.logger.error(
            `FALLO al enviar email de bienvenida a ${usuario.correo}`,
            emailError instanceof Error ? emailError.stack : String(emailError),
          );
        });

      return { ok: true, id_usuario: usuario.id_usuario };
    } catch (err: unknown) {
      this.logger.error('Error en create responsable:', errorToLog(err));
      if (err instanceof HttpException) throw err;
      if (isKnownPrismaError(err))
        throw new BadRequestException(formatPrismaError(err));
      throw new BadRequestException('No se pudo registrar el responsable');
    }
  }

  async findAll(filters: FilterResponsableDto) {
    return this.prisma.responsables_area.findMany({
      where: {
        id_area: filters.id_area,
        activo: filters.activo,
      },
      include: {
        usuario: true,
        area: true,
      },
    });
  }

  async update(id: number, dto: UpdateResponsableDto) {
    // TU LÓGICA DE UPDATE RESTAURADA
    // El código de tus amigos no manejaba el cambio de área correctamente (cuando quitas a uno para poner a otro)
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario: id },
    });
    if (!usuario) throw new NotFoundException('Responsable no encontrado');

    // Validar duplicados en campos que cambian
    if (dto.correo || dto.ci || dto.telefono) {
      const dup = await this.prisma.usuarios.findFirst({
        where: {
          AND: [
            { id_usuario: { not: id } },
            {
              OR: [
                dto.correo ? { correo: dto.correo } : undefined,
                dto.ci ? { ci: dto.ci } : undefined,
                dto.telefono ? { telefono: dto.telefono } : undefined,
              ].filter(Boolean) as any,
            },
          ],
        },
      });

      if (dup) {
        if (dto.correo && dup.correo === dto.correo)
          throw new BadRequestException('El correo ya está registrado');
        if (dto.ci && dup.ci === dto.ci)
          throw new BadRequestException('El CI ya está registrado');
        if (dto.telefono && dup.telefono === dto.telefono)
          throw new BadRequestException('El teléfono ya está registrado');
      }
    }

    // Validar lógica de área única (TU CÓDIGO IMPORTANTE)
    if (typeof dto.id_area === 'number') {
      const relacionActual = await this.prisma.responsables_area.findFirst({
        where: { id_usuario: id },
      });

      // Si cambia el área, validar que la nueva no esté ocupada
      if (!relacionActual || relacionActual.id_area !== dto.id_area) {
        const ocupada = await this.prisma.responsables_area.findFirst({
          where: { id_area: dto.id_area, activo: true },
        });
        if (ocupada) {
          throw new BadRequestException(
            'El área ya tiene un responsable asignado',
          );
        }

        if (relacionActual) {
          // actualizar a nueva área
          await this.prisma.responsables_area.update({
            where: { id_responsable_area: relacionActual.id_responsable_area },
            data: { id_area: dto.id_area },
          });
        } else {
          // crear relación si no existía
          await this.prisma.responsables_area.create({
            data: { id_usuario: id, id_area: dto.id_area },
          });
        }
      }
    }

    // Actualizar datos de usuario
    return this.prisma.usuarios.update({
      where: { id_usuario: id },
      data: {
        nombre: dto.nombre ?? undefined,
        apellido: dto.apellido ?? undefined,
        correo: dto.correo ?? undefined,
        telefono: dto.telefono ?? undefined,
        institucion: dto.institucion ?? undefined,
        experiencia: dto.experiencia ?? undefined,
        especialidad: dto.especialidad ?? undefined,
        ci: dto.ci ?? undefined,
      },
    });
  }

  async remove(id_usuario: number) {
    // Usamos tu nombre de función 'remove' y tu lógica de eliminar relación primero
    const rel = await this.prisma.responsables_area.findFirst({
      where: { id_usuario },
    });

    if (rel) {
      await this.prisma.responsables_area.delete({
        where: { id_responsable_area: rel.id_responsable_area },
      });
    }

    await this.prisma.usuarios.delete({
      where: { id_usuario },
    });

    return { ok: true, message: 'Responsable eliminado correctamente' };
  }

  async toggleActivo(id_responsable_area: number) {
    const responsable = await this.prisma.responsables_area.findUnique({
      where: { id_responsable_area },
    });
    if (!responsable) throw new NotFoundException('Responsable no encontrado');

    return this.prisma.responsables_area.update({
      where: { id_responsable_area },
      data: { activo: !responsable.activo },
    });
  }

  // --- CHECKERS (TU CÓDIGO RESTAURADO) ---
  // Tus amigos borraron el checkArea, que es vital para el frontend
  async checkTelefono(telefono: string) {
    const exists = await this.prisma.usuarios.findFirst({
      where: { telefono },
    });
    return { exists: !!exists };
  }

  async checkCi(ci: string) {
    const exists = await this.prisma.usuarios.findFirst({ where: { ci } });
    return { exists: !!exists };
  }

  async checkCorreo(correo: string) {
    const exists = await this.prisma.usuarios.findFirst({ where: { correo } });
    return { exists: !!exists };
  }

  async checkArea(id_area: number) {
    const exists = await this.prisma.responsables_area.findFirst({
      where: { id_area, activo: true },
    });
    return { exists: !!exists };
  }
}
