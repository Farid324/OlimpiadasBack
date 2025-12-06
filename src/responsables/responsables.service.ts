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
import { Prisma } from '@prisma/client';
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

  // src/responsables/responsables.service.ts
  async create(dto: CreateResponsableDto) {
    try {
      const gestion = await this.prisma.gestiones.findFirst({
        where: { estado: 'ABIERTA' },
      });
      if (!gestion) throw new BadRequestException('No hay gestión abierta.');

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

      // 2. Validar Área Ocupada EN LA GESTIÓN ACTUAL
      const ocupada = await this.prisma.responsables_area.findFirst({
        where: {
          id_area: dto.id_area,
          id_gestion: gestion.id_gestion,
          activo: true,
        },
      });

      if (ocupada) {
        throw new BadRequestException(
          'El área ya tiene un responsable asignado en la gestión actual',
        );
      }

      // 3. Preparar datos (CI = password + Rol dinámico)
      if (!dto.ci || !dto.ci.trim()) {
        throw new BadRequestException(
          'El CI es obligatorio para la contraseña inicial.',
        );
      }
      const tempPassword = dto.ci.trim();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const idRolResponsable = await this.getResponsableRoleId();

      const experienciaFinal =
        typeof dto.experiencia === 'number' && dto.experiencia > 0
          ? dto.experiencia
          : 1;

      const usuario = await this.prisma.usuarios.create({
        data: {
          nombre: dto.nombre,
          apellido: dto.apellido,
          correo: dto.correo,
          hash_password: hashedPassword,
          telefono: dto.telefono,
          institucion: dto.institucion,
          experiencia: experienciaFinal,
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
          id_gestion: gestion.id_gestion,
        },
      });

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
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      select: { id_gestion: true },
    });

    if (!gestion) {
      return [];
    }

    return this.prisma.responsables_area.findMany({
      where: {
        id_gestion: gestion.id_gestion,
        id_area: filters.id_area ?? undefined,
        activo:
          typeof filters.activo === 'boolean' ? filters.activo : undefined,
      },
      include: {
        usuario: true,
        area: true,
      },
    });
  }

  async update(id: number, dto: UpdateResponsableDto) {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!gestion) throw new BadRequestException('No hay gestión abierta.');
    // TU LÓGICA DE UPDATE RESTAURADA
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario: id },
    });
    if (!usuario) throw new NotFoundException('Responsable no encontrado');

    // Validar duplicados en campos que cambian
    if (dto.correo || dto.ci || dto.telefono) {
      const orConditions: Prisma.usuariosWhereInput[] = [];
      if (dto.correo) orConditions.push({ correo: dto.correo });
      if (dto.ci) orConditions.push({ ci: dto.ci });
      if (dto.telefono) orConditions.push({ telefono: dto.telefono });

      if (orConditions.length > 0) {
        const dup = await this.prisma.usuarios.findFirst({
          where: {
            AND: [{ id_usuario: { not: id } }, { OR: orConditions }],
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
    }
    // Validar lógica de área única (TU CÓDIGO IMPORTANTE)
    // Validar lógica de área única (TU CÓDIGO IMPORTANTE)
    if (typeof dto.id_area === 'number') {
      // Gestión abierta ya la tienes arriba
      const relacionActual = await this.prisma.responsables_area.findFirst({
        where: {
          id_usuario: id,
          id_gestion: gestion.id_gestion,
        },
      });

      // Validar que el el area nueva no se muestre ocupada en la gestion actual
      const ocupada = await this.prisma.responsables_area.findFirst({
        where: {
          id_area: dto.id_area,
          id_gestion: gestion.id_gestion,
          activo: true,
          id_usuario: { not: id },
        },
      });

      if (ocupada) {
        throw new BadRequestException(
          'El área ya tiene un responsable asignado en la gestión actual',
        );
      }

      if (relacionActual) {
        // Solo cambias el área, manteniendo id_gestion de la gestión abierta
        await this.prisma.responsables_area.update({
          where: { id_responsable_area: relacionActual.id_responsable_area },
          data: { id_area: dto.id_area },
        });
      } else {
        // No existía para esta gestión -> creas una nueva relación
        await this.prisma.responsables_area.create({
          data: {
            id_usuario: id,
            id_area: dto.id_area,
            id_gestion: gestion.id_gestion,
          },
        });
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
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Eliminar relaciones de responsable_area (todas las gestiones)
        await tx.responsables_area.deleteMany({
          where: { id_usuario },
        });

        try {
          // Intentar borrar el usuario físicamente
          await tx.usuarios.delete({
            where: { id_usuario },
          });
          return {
            ok: true,
            deleted: true,
            softDeleted: false,
            message: 'Responsable eliminado correctamente',
          };
        } catch (e: unknown) {
          // Si hay FKs (por ejemplo, usado en cierres), baja lógica
          if (isKnownPrismaError(e) && e.code === 'P2003') {
            await tx.usuarios.update({
              where: { id_usuario },
              data: { activo: false },
            });
            return {
              ok: true,
              deleted: false,
              softDeleted: true,
              message:
                'Responsable desactivado porque tiene registros relacionados.',
            };
          }
          throw e;
        }
      });
    } catch (err: unknown) {
      this.logger.error('Error al eliminar responsable:', errorToLog(err));
      if (isKnownPrismaError(err)) {
        throw new BadRequestException(formatPrismaError(err));
      }
      if (err instanceof HttpException) throw err;
      throw new BadRequestException(
        formatPrismaError(err) || 'No se pudo eliminar el responsable',
      );
    }
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
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      select: { id_gestion: true },
    });

    if (!gestion) {
      return { exists: false };
    }

    const exists = await this.prisma.responsables_area.findFirst({
      where: {
        id_area,
        id_gestion: gestion.id_gestion,
        activo: true,
      },
    });
    return { exists: !!exists };
  }
}
