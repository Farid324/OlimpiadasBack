//src/evaluadores/evaluadores.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { QueryEvaluadorDto } from './dto/query-evaluador.dto';
import { CreateEvaluadorDto } from './dto/create-evaluador.dto';
import { UpdateEvaluadorDto } from './dto/update-evaluador.dto'; // ⬅️ nuevo
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';

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

type CreateEvaluadorInput = CreateEvaluadorDto & {
  nombreCompleto?: string;
  id_areas?: number[];
};

type UpdateEvaluadorInput = UpdateEvaluadorDto & {
  nombreCompleto?: string;
  id_areas?: number[];
};

function partirNombreCompleto(full?: string): {
  nombre?: string;
  apellido?: string;
} {
  const v = (full ?? '').trim();
  if (!v) return {};
  const p = v.split(/\s+/);
  if (p.length < 2) {
    throw new BadRequestException(
      'nombreCompleto debe incluir al menos nombre y apellido',
    );
  }
  if (p.length === 4)
    return { nombre: p.slice(0, 2).join(' '), apellido: p.slice(2).join(' ') };
  if (p.length === 3) return { nombre: p[0], apellido: p.slice(1).join(' ') };
  return { nombre: p[0], apellido: p.slice(1).join(' ') };
}
@Injectable()
export class EvaluadoresService {
  private readonly logger = new Logger(EvaluadoresService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /** GET /evaluadores */
  async findAll(query: QueryEvaluadorDto) {
    const { q, telefono, ci } = query ?? {};
    const baseWhere: Prisma.usuariosWhereInput = {
      rol: { is: { nombre: 'EVALUADOR' } },
    };

    const select = {
      id_usuario: true,
      nombre: true,
      apellido: true,
      correo: true,
      telefono: true,
      ci: true,
      institucion: true,
      especialidad: true,
      experiencia: true,
      activo: true,
      evaluadores_area: {
        select: { area: { select: { id_area: true, nombre_area: true } } },
      },
    } satisfies Prisma.usuariosSelect;

    if (telefono) {
      return this.prisma.usuarios.findMany({
        where: { ...baseWhere, telefono },
        select,
        orderBy: { id_usuario: 'desc' },
      });
    }

    if (ci) {
      return this.prisma.usuarios.findMany({
        where: { ...baseWhere, ci },
        select,
        orderBy: { id_usuario: 'desc' },
      });
    }

    return this.prisma.usuarios.findMany({
      where: {
        ...baseWhere,
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' } },
                { apellido: { contains: q, mode: 'insensitive' } },
                { correo: { contains: q, mode: 'insensitive' } },
                { institucion: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select,
      orderBy: { id_usuario: 'desc' },
    });
  }

  /** Helper: Obtiene el id_rol del rol 'EVALUADOR' desde la tabla "roles" */
  private async getEvaluadorRoleId(): Promise<number> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id_rol: number }>>(
        `SELECT id_rol FROM "roles" WHERE nombre = 'EVALUADOR' LIMIT 1`,
      );
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id_rol != null) {
        return rows[0].id_rol;
      }
    } catch (e: unknown) {
      throw new BadRequestException(
        `Error leyendo tabla "roles": ${formatPrismaError(e)}`,
      );
    }

    throw new NotFoundException(
      'No se encontró el rol "EVALUADOR" en la tabla "roles". Verifica que exista ese registro.',
    );
  }

  private async assertAreasExisten(id_areas: number[]) {
    if (!Array.isArray(id_areas) || id_areas.length === 0) return;
    const existentes = await this.prisma.areas.findMany({
      where: { id_area: { in: id_areas } },
      select: { id_area: true },
    });
    const set = new Set(existentes.map((a) => a.id_area));
    const faltantes = id_areas.filter((id) => !set.has(id));
    if (faltantes.length) {
      throw new BadRequestException(
        `Áreas inexistentes: ${faltantes.join(', ')}`,
      );
    }
  }

  /** POST /evaluadores */
  async create(dto: CreateEvaluadorInput) {
    try {
      // ... (lógica para nombre, apellido, CI, validaciones, duplicados) ...
      let { nombre, apellido } = dto;
      if ((!nombre || !apellido) && dto.nombreCompleto) {
        const p = partirNombreCompleto(dto.nombreCompleto);
        nombre = nombre ?? p.nombre;
        apellido = apellido ?? p.apellido;
      }
      if (!nombre?.trim() || !apellido?.trim()) {
        throw new BadRequestException('Nombre y apellido son obligatorios');
      }
      const {
        correo,
        telefono,
        ci,
        institucion,
        especialidad,
        experiencia,
        activo,
        id_areas,
      } = dto;

      // 🔹 experiencia por defecto: si viene undefined/null, se usa 1 año
      const experienciaFinal =
        experiencia === undefined || experiencia === null ? 1 : experiencia;

      if (!ci || !ci.trim()) {
        throw new BadRequestException(
          'El CI es obligatorio para generar la contraseña inicial.',
        );
      }
      const tempPassword = ci.trim();
      const idRolEvaluador = await this.getEvaluadorRoleId();
      if (correo) {
        const dupCorreo = await this.prisma.usuarios.findFirst({
          where: { correo },
          select: { id_usuario: true },
        });
        if (dupCorreo)
          throw new BadRequestException('El correo ya está registrado');
      }
      if (telefono) {
        const dupTel = await this.prisma.usuarios.findFirst({
          where: { telefono },
          select: { id_usuario: true },
        });
        if (dupTel)
          throw new BadRequestException('El teléfono ya está registrado');
      }
      if (ci) {
        const dupCi = await this.prisma.usuarios.findFirst({
          where: { ci },
          select: { id_usuario: true },
        });
        if (dupCi) throw new BadRequestException('El CI ya está registrado');
      }
      if (!correo?.trim()) {
        throw new BadRequestException('Correo es obligatorio');
      }
      await this.assertAreasExisten(id_areas || []);

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

      const data: Prisma.usuariosCreateInput = {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        correo: correo.trim(),
        // CORRECCIÓN AQUÍ: Usa hashedPassword en lugar de 'temporal'
        hash_password: hashedPassword,
        activo: typeof activo === 'boolean' ? activo : true,
        rol: { connect: { id_rol: idRolEvaluador } },

        ...(telefono !== undefined ? { telefono } : {}),
        ...(ci !== undefined ? { ci: tempPassword } : {}), // Guardamos el CI
        ...(institucion !== undefined ? { institucion } : {}),
        ...(especialidad !== undefined ? { especialidad } : {}),
        // usamos experienciaFinal para garantizar mínimo 1 año
        ...(experienciaFinal !== undefined ? { experiencia: experienciaFinal } : {}),
      };

      const created = await this.prisma.usuarios.create({
        data,
        select: { id_usuario: true, nombre: true, correo: true }, // Pedimos datos para el email
      });

      // ... (lógica para crear evaluadores_area) ...
      if (Array.isArray(id_areas) && id_areas.length > 0) {
        await this.prisma.evaluadores_area.createMany({
          data: id_areas.map((id_area) => ({
            id_usuario: created.id_usuario,
            id_area,
          })),
          skipDuplicates: true,
        });
      }
      // ... (lógica para enviar correo) ...
      this.emailService
        .sendEvaluatorWelcomeEmail(
          created.correo,
          created.nombre,
          tempPassword, // Enviamos el CI (sin hashear) como contraseña temporal
        )
        .catch((emailError) => {
          // Si el envío falla, solo lo registramos en los logs del servidor
          this.logger.error(
            `FALLO al enviar email de bienvenida a ${created.correo} (Usuario ID: ${created.id_usuario})`,
            emailError instanceof Error ? emailError.stack : String(emailError),
          );
          // IMPORTANTE: NO lanzamos 'throw emailError' para no causar un 500
        });

      return { ok: true, id_usuario: created.id_usuario };
    } catch (err: unknown) {
      // ... (manejo de errores) ...
      console.error('ERROR create evaluador ->', errorToLog(err));
      if (isKnownPrismaError(err))
        throw new BadRequestException(formatPrismaError(err));
      if (err instanceof HttpException) throw err;
      throw new BadRequestException(
        formatPrismaError(err) || 'No se pudo registrar el evaluador',
      );
    }
  }

  /** GET /evaluadores/check-telefono/:telefono */
  async existsByTelefono(telefono: string) {
    const found = await this.prisma.usuarios.findFirst({
      where: { rol: { nombre: 'EVALUADOR' }, telefono },
      select: { id_usuario: true },
    });
    return { exists: !!found };
  }

  /** GET /evaluadores/check-ci/:ci */
  async existsByCi(ci: string) {
    const found = await this.prisma.usuarios.findFirst({
      where: { rol: { nombre: 'EVALUADOR' }, ci },
      select: { id_usuario: true },
    });
    return { exists: !!found };
  }

  /** PATCH /evaluadores/:id */
  async update(id: number, dto: UpdateEvaluadorInput) {
    try {
      let nombre = dto.nombre;
      let apellido = dto.apellido;

      if (dto.nombreCompleto && (!nombre || !apellido)) {
        const p = partirNombreCompleto(dto.nombreCompleto);
        nombre = nombre ?? p.nombre;
        apellido = apellido ?? p.apellido;
      }

      // duplicados (excluye al propio id)
      if (dto.correo) {
        const dupCorreo = await this.prisma.usuarios.findFirst({
          where: { correo: dto.correo, id_usuario: { not: id } },
          select: { id_usuario: true },
        });
        if (dupCorreo)
          throw new BadRequestException(
            'El correo ya está registrado en otro usuario',
          );
      }
      if (dto.telefono) {
        const dupTel = await this.prisma.usuarios.findFirst({
          where: { telefono: dto.telefono, id_usuario: { not: id } },
          select: { id_usuario: true },
        });
        if (dupTel)
          throw new BadRequestException(
            'El teléfono ya está registrado en otro usuario',
          );
      }
      if (dto.ci) {
        const dupCi = await this.prisma.usuarios.findFirst({
          where: { ci: dto.ci, id_usuario: { not: id } },
          select: { id_usuario: true },
        });
        if (dupCi)
          throw new BadRequestException(
            'El CI ya está registrado en otro usuario',
          );
      }

      if (dto.id_areas) {
        await this.assertAreasExisten(dto.id_areas);
      }

      const data: Prisma.usuariosUpdateInput = {};
      if (typeof nombre === 'string' && nombre.trim()) {
        data.nombre = { set: nombre.trim() };
      }
      if (typeof apellido === 'string' && apellido.trim()) {
        data.apellido = { set: apellido.trim() };
      }

      if (dto.correo !== undefined) {
        // En tu schema, "correo" es String (NO NULL). Si llega null, error.
        if (dto.correo === null) {
          throw new BadRequestException('correo no puede ser null');
        }
        data.correo = { set: dto.correo };
      }

      if (dto.telefono !== undefined) {
        // telefono es String? → admite string | null
        data.telefono = { set: dto.telefono };
      }
      if (dto.ci !== undefined) {
        data.ci = { set: dto.ci };
      }
      if (dto.institucion !== undefined) {
        data.institucion = { set: dto.institucion };
      }
      if (dto.especialidad !== undefined) {
        data.especialidad = { set: dto.especialidad };
      }
      if (dto.experiencia !== undefined) {
        data.experiencia = { set: dto.experiencia };
      }

      const select = {
        id_usuario: true,
        nombre: true,
        apellido: true,
        correo: true,
        telefono: true,
        ci: true,
        institucion: true,
        especialidad: true,
        experiencia: true,
        activo: true,
        evaluadores_area: {
          select: { area: { select: { id_area: true, nombre_area: true } } },
        },
      } satisfies Prisma.usuariosSelect;

      return await this.prisma.$transaction(async (tx) => {
        const exists = await tx.usuarios.findUnique({
          where: { id_usuario: id },
          select: { id_usuario: true },
        });
        if (!exists) throw new NotFoundException('Evaluador no encontrado');
        if (Object.keys(data).length > 0) {
          await tx.usuarios.update({ where: { id_usuario: id }, data });
        }

        if (dto.id_areas) {
          await tx.evaluadores_area.deleteMany({ where: { id_usuario: id } });
          if (dto.id_areas.length) {
            await tx.evaluadores_area.createMany({
              data: dto.id_areas.map((id_area) => ({
                id_usuario: id,
                id_area,
              })),
              skipDuplicates: true,
            });
          }
        }

        return tx.usuarios.findUnique({ where: { id_usuario: id }, select });
      });
    } catch (err: unknown) {
      if (isKnownPrismaError(err)) {
        throw new BadRequestException(formatPrismaError(err));
      }
      if (err instanceof HttpException) throw err;
      throw new BadRequestException(
        formatPrismaError(err) || 'No se pudo actualizar el evaluador',
      );
    }
  }

  /** DELETE /evaluadores/:id */
  async remove(id: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.evaluadores_area.deleteMany({ where: { id_usuario: id } });

        try {
          await tx.usuarios.delete({ where: { id_usuario: id } });
          return { ok: true, deleted: true };
        } catch (e: unknown) {
          // Si hay FK, baja lógica
          if (isKnownPrismaError(e) && e.code === 'P2003') {
            await tx.usuarios.update({
              where: { id_usuario: id },
              data: { activo: false },
            });
            return { ok: true, deleted: false, softDeleted: true };
          }
          throw e;
        }
      });
    } catch (err: unknown) {
      if (isKnownPrismaError(err)) {
        throw new BadRequestException(formatPrismaError(err));
      }
      if (err instanceof HttpException) throw err;
      throw new BadRequestException(
        formatPrismaError(err) || 'No se pudo eliminar el evaluador',
      );
    }
  }
}
