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
import { AsignarOlimpistasDto } from './dto/asignar-olimpistas.dto';

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

    // Gest abierta (para filtrar las áreas por gestion)
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      select: { id_gestion: true },
    });

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
        where: gestion
          ? { id_gestion: gestion.id_gestion, activo: true }
          : { activo: true },
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
      const gestion = await this.prisma.gestiones.findFirst({
        where: { estado: 'ABIERTA' },
      });
      if (!gestion) {
        throw new BadRequestException(
          'No existe una gestión abierta para registrar evaluadores.',
        );
      }
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
        ...(experienciaFinal !== undefined
          ? { experiencia: experienciaFinal }
          : {}),
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
            id_gestion: gestion.id_gestion, // <--- AGREGADO
            activo: true, // Asegúrate de mandar activo si es necesario
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

  // Devuelve resumen de inscripciones y qué fase se puede editar
  async getEstadoAsignacionArea(id_area: number) {
    if (!id_area || Number.isNaN(Number(id_area))) {
      throw new BadRequestException('id_area inválido');
    }

    // Gestión abierta para calculo
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      select: { id_gestion: true },
    });

    if (!gestion) {
      throw new BadRequestException(
        'No hay una gestión abierta para consultar el estado de asignación.',
      );
    }

    // Total de inscripciones de esa area (fase clasificatoria) en la gestion actual
    const totalClasif = await this.prisma.inscripciones.count({
      where: { id_area, id_gestion: gestion.id_gestion },
    });

    // Total de FINALISTAS en esa área (clasificados) en la gestión actual
    const totalFinal = await this.prisma.inscripciones.count({
      where: {
        id_area,
        id_gestion: gestion.id_gestion,
        clasificacion: 'CLASIFICADO',
      },
    });

    // Regla:
    //  - Mientras NO haya finalistas → solo se edita clasif.
    //  - Cuando YA hay finalistas → solo se edita final.
    const puedeEditarFinal = totalFinal > 0;
    const puedeEditarClasificatoria = !puedeEditarFinal;

    return {
      id_area,
      totalClasif,
      totalFinal,
      puedeEditarClasificatoria,
      puedeEditarFinal,
    };
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
      const gestion = await this.prisma.gestiones.findFirst({
        where: { estado: 'ABIERTA' },
      });
      if (!gestion) {
        throw new BadRequestException(
          'No hay una gestión abierta para realizar cambios.',
        );
      }
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
                id_gestion: gestion.id_gestion, // <--- ⚠️ ESTO FALTABA
                activo: true,
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

  async asignarOlimpistas(dto: AsignarOlimpistasDto) {
    const { id_area, asignaciones } = dto;

    if (!id_area || Number.isNaN(Number(id_area))) {
      throw new BadRequestException('id_area inválido');
    }

    if (!Array.isArray(asignaciones) || asignaciones.length === 0) {
      throw new BadRequestException('Se requieren asignaciones.');
    }

    // Gestión ABIERTA obligatoria para distribuir cupos
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      select: { id_gestion: true },
    });

    if (!gestion) {
      throw new BadRequestException(
        'No hay una gestión abierta para asignar olimpistas.',
      );
    }

    // 1) Obtener totales de inscripciones EN LA GESTIÓN ACTUAL
    const [totalClasif, totalFinal] = await Promise.all([
      this.prisma.inscripciones.count({
        where: { id_area, id_gestion: gestion.id_gestion },
      }),
      this.prisma.inscripciones.count({
        where: {
          id_area,
          id_gestion: gestion.id_gestion,
          clasificacion: 'CLASIFICADO',
        },
      }),
    ]);

    // 2) Determinar modo: CLASIFICATORIA o FINAL
    const faseClasif = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'CLASIFICATORIA' },
    });
    const faseFinal = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'FINAL' },
    });

    if (!faseClasif || !faseFinal) {
      throw new BadRequestException(
        'No se encontraron las fases CLASIFICATORIA y FINAL en la base de datos.',
      );
    }

    type Modo = 'CLASIF' | 'FINAL';
    const modo: Modo = totalFinal > 0 ? 'FINAL' : 'CLASIF';

    const idFase = modo === 'CLASIF' ? faseClasif.id_fase : faseFinal.id_fase;
    const totalDisponibles = modo === 'CLASIF' ? totalClasif : totalFinal;

    if (totalDisponibles === 0) {
      throw new BadRequestException(
        modo === 'CLASIF'
          ? 'No hay inscripciones en esta área para asignar en fase clasificatoria.'
          : 'No hay finalistas en esta área para asignar en fase final.',
      );
    }

    // 3) Obtener evaluadores del área EN LA GESTIÓN ACTUAL
    const evaluadoresArea = await this.prisma.evaluadores_area.findMany({
      where: {
        id_area,
        activo: true,
        id_gestion: gestion.id_gestion,
      },
      select: {
        id_evaluador_area: true,
        id_usuario: true,
      },
      orderBy: { id_usuario: 'asc' },
    });

    if (!evaluadoresArea.length) {
      throw new BadRequestException(
        'No hay evaluadores activos registrados para esta área en la gestión actual.',
      );
    }

    // 4) Mapear asignaciones por evaluador_area
    const lista = evaluadoresArea.map((ea) => {
      const found = asignaciones.find((a) => a.id_usuario === ea.id_usuario);

      return {
        id_evaluador_area: ea.id_evaluador_area,
        id_usuario: ea.id_usuario,
        cupo_clasif:
          found && typeof found.cupo_clasificacion === 'number'
            ? found.cupo_clasificacion
            : undefined,
        cupo_final:
          found && typeof found.cupo_final === 'number'
            ? found.cupo_final
            : undefined,
      };
    });

    // 5) Tomar solo los cupos de la fase que toca
    const campoCupo: 'cupo_clasif' | 'cupo_final' =
      modo === 'CLASIF' ? 'cupo_clasif' : 'cupo_final';

    // cupo > 0
    const conCupo = lista.filter((item) => {
      const v = item[campoCupo];
      return typeof v === 'number' && v > 0;
    });

    // cupo indefinido (sin valor) → lo usaremos para el "resto"
    const sinCupo = lista.filter((item) => item[campoCupo] === undefined);

    if (sinCupo.length > 1) {
      throw new BadRequestException(
        'Debe quedar como máximo un evaluador sin cupo asignado para distribuir el resto automáticamente.',
      );
    }

    const totalAsignado = conCupo.reduce(
      (sum, item) => sum + (item[campoCupo] as number),
      0,
    );

    if (totalAsignado > totalDisponibles) {
      throw new BadRequestException(
        `La suma de cupos (${totalAsignado}) supera el total disponible (${totalDisponibles}).`,
      );
    }

    const restante = totalDisponibles - totalAsignado;

    // Si sobra algo, lo asignamos al único evaluador sin cupo
    if (restante > 0) {
      if (sinCupo.length === 1) {
        sinCupo[0][campoCupo] = restante;
      } else {
        throw new BadRequestException(
          `Quedan ${restante} olimpistas sin asignar. Deja un evaluador sin cupo para que reciba el resto automáticamente.`,
        );
      }
    }

    // 6) Guardar en asignacion_evaluador_fase para la fase correspondiente
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const item of lista) {
          const cupo = item[campoCupo] ?? 0;

          await tx.asignacion_evaluador_fase.upsert({
            where: {
              uq_eval_area_fase: {
                id_evaluador_area: item.id_evaluador_area,
                id_fase: idFase,
              },
            },
            create: {
              id_evaluador_area: item.id_evaluador_area,
              id_fase: idFase,
              cupo,
            },
            update: {
              cupo,
            },
          });
        }
      });

      return {
        ok: true,
        modo,
        totalDisponibles,
      };
    } catch (err) {
      this.logger.error('Error al asignar olimpistas', err);
      throw new BadRequestException(
        'No se pudo guardar la asignación de olimpistas.',
      );
    }
  }

  private distribuirCupos(
    total: number,
    asignaciones: {
      id_usuario: number;
      cupo_clasificacion?: number;
      cupo_final?: number;
    }[],
    key: 'cupo_clasificacion' | 'cupo_final',
  ): Record<number, number> {
    if (total <= 0) {
      const allZero: Record<number, number> = {};
      for (const a of asignaciones) {
        allZero[a.id_usuario] = 0;
      }
      return allZero;
    }

    let sumaFija = 0;
    const fijos: Record<number, number> = {};
    const autos: number[] = [];

    for (const a of asignaciones) {
      const raw = a[key];
      if (raw === undefined || raw === null || raw === 0) {
        autos.push(a.id_usuario);
        continue;
      }

      const val = Math.floor(raw);
      if (val < 0) {
        throw new BadRequestException('Los cupos no pueden ser negativos.');
      }

      sumaFija += val;
      fijos[a.id_usuario] = val;
    }

    if (autos.length === 0) {
      if (sumaFija !== total) {
        throw new BadRequestException(
          `La suma de cupos (${sumaFija}) no coincide con el total de olimpistas (${total}).`,
        );
      }
      return fijos;
    }

    if (autos.length > 1) {
      throw new BadRequestException(
        'Debe quedar como máximo un evaluador sin cupo asignado para distribuir el resto automáticamente.',
      );
    }

    const sobrante = total - sumaFija;
    if (sobrante < 0) {
      throw new BadRequestException(
        `La suma de cupos (${sumaFija}) es mayor que el total de olimpistas (${total}).`,
      );
    }

    const [idAuto] = autos;
    return {
      ...fijos,
      [idAuto]: sobrante,
    };
  }
}
