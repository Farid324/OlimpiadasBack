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

  async create(dto: CreateResponsableDto) {
    try {
      const gestion = await this.prisma.gestiones.findFirst({
        where: { estado: 'ABIERTA' },
      });
      if (!gestion) throw new BadRequestException('No hay gestión abierta.');

      // Normalización básica (CLAVE para no validar teléfono vacío)
      const correo = dto.correo?.trim();
      const ciTrim = dto.ci?.trim();
      const tel = dto.telefono?.trim() || undefined;

      // Validar duplicados globales de CORREO
      const dupCorreo = await this.prisma.usuarios.findFirst({
        where: { correo },
      });
      if (dupCorreo) {
        throw new BadRequestException('El correo ya está registrado');
      }

      // SOLO validar teléfono si realmente viene con valor
      if (tel) {
        const dupTelefono = await this.prisma.usuarios.findFirst({
          where: { telefono: tel },
        });
        if (dupTelefono) {
          throw new BadRequestException('El teléfono ya está registrado');
        }
      }

      // Validar CI solo en la gestión actual
      if (ciTrim) {
        const dupCiEnGestion = await this.prisma.responsables_area.findFirst({
          where: {
            id_gestion: gestion.id_gestion,
            usuario: {
              ci: ciTrim,
            },
          },
          include: { usuario: true },
        });

        if (dupCiEnGestion) {
          throw new BadRequestException(
            'El CI ya está registrado para un responsable en la gestión actual',
          );
        }
      }

      // Validar Área Ocupada EN LA GESTIÓN ACTUAL
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

      // Preparar datos (CI = password + Rol dinámico)
      if (!ciTrim) {
        throw new BadRequestException(
          'El CI es obligatorio para la contraseña inicial.',
        );
      }
      const tempPassword = ciTrim;
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
          correo,
          hash_password: hashedPassword,
          // guardar solo si viene
          telefono: tel,
          institucion: dto.institucion || undefined,
          experiencia: experienciaFinal,
          especialidad: dto.especialidad || undefined,
          ci: ciTrim,
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
        activo: typeof filters.activo === 'boolean' ? filters.activo : undefined,
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

    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario: id },
    });
    if (!usuario) throw new NotFoundException('Responsable no encontrado');

    // Validar duplicados en campos que cambian (sin meter vacíos)
    if (dto.correo || dto.telefono) {
      const orConditions: Prisma.usuariosWhereInput[] = [];

      const correo = dto.correo?.trim();
      const tel = dto.telefono?.trim();

      if (correo) orConditions.push({ correo });
      if (tel) orConditions.push({ telefono: tel });

      if (orConditions.length > 0) {
        const dup = await this.prisma.usuarios.findFirst({
          where: {
            AND: [{ id_usuario: { not: id } }, { OR: orConditions }],
          },
        });

        if (dup) {
          if (correo && dup.correo === correo)
            throw new BadRequestException('El correo ya está registrado');
          if (tel && dup.telefono === tel)
            throw new BadRequestException('El teléfono ya está registrado');
        }
      }
    }

    // Validar CI solo a nivel de gestión (puede repetirse en otras gestiones)
    if (dto.ci && dto.ci.trim()) {
      const dupCiEnGestion = await this.prisma.responsables_area.findFirst({
        where: {
          id_gestion: gestion.id_gestion,
          id_usuario: { not: id },
          usuario: {
            ci: dto.ci.trim(),
          },
        },
        include: { usuario: true },
      });

      if (dupCiEnGestion) {
        throw new BadRequestException(
          'El CI ya está registrado para otro responsable en la gestión actual',
        );
      }
    }

    // Validar lógica de área única
    if (typeof dto.id_area === 'number') {
      const relacionActual = await this.prisma.responsables_area.findFirst({
        where: {
          id_usuario: id,
          id_gestion: gestion.id_gestion,
        },
      });

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
        await this.prisma.responsables_area.update({
          where: { id_responsable_area: relacionActual.id_responsable_area },
          data: { id_area: dto.id_area },
        });
      } else {
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
        correo: dto.correo?.trim() ?? undefined,
        telefono: dto.telefono?.trim() || undefined,
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
        await tx.responsables_area.deleteMany({
          where: { id_usuario },
        });

        try {
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

  // --- CHECKERS ---
  async checkTelefono(telefono: string) {
    const tel = telefono?.trim();
    if (!tel) return { exists: false };

    const exists = await this.prisma.usuarios.findFirst({
      where: { telefono: tel },
    });
    return { exists: !!exists };
  }

  async checkCi(ci: string) {
    const ciTrim = ci?.trim();
    if (!ciTrim) return { exists: false };

    const exists = await this.prisma.usuarios.findFirst({
      where: { ci: ciTrim },
    });
    return { exists: !!exists };
  }

  async checkCorreo(correo: string) {
    const c = correo?.trim();
    if (!c) return { exists: false };

    const exists = await this.prisma.usuarios.findFirst({
      where: { correo: c },
    });
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

