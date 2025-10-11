import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { QueryEvaluadorDto } from './dto/query-evaluador.dto';
import { CreateEvaluadorDto } from './dto/create-evaluador.dto';

function formatPrismaError(err: any): string {
  if (err?.code) {
    const code = String(err.code);
    const meta = err?.meta ? ` | meta: ${JSON.stringify(err.meta)}` : '';
    switch (code) {
      case 'P2002': return `Duplicado en ${(err.meta?.target as string[])?.join(', ') || 'campo único'}`;
      case 'P2003': return `Violación de clave foránea en ${String(err.meta?.field_name || 'relación')}${meta}`;
      case 'P2000': return `Valor demasiado largo para un campo${meta}`;
      case 'P2011': return `Hay un campo obligatorio sin valor${meta}`;
      case 'P2025': return `Registro relacionado no encontrado${meta}`;
      default:      return `Error Prisma ${code}${meta}`;
    }
  }
  const msg = err?.response?.message;
  if (msg) return Array.isArray(msg) ? msg.join(', ') : String(msg);
  return err?.message ? String(err.message) : 'Error desconocido';
}

@Injectable()
export class EvaluadoresService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /evaluadores */
  async findAll(query: QueryEvaluadorDto) {
    const { q, telefono, ci } = query ?? {};
    const baseWhere: any = { rol: { nombre: 'EVALUADOR' } };

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
    };

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
      // Consulta directa a la tabla "roles" (tal como está en tu BD)
      const rows = await this.prisma.$queryRawUnsafe<{ id_rol: number }[]>(
        `SELECT id_rol FROM "roles" WHERE nombre = 'EVALUADOR' LIMIT 1`
      );
      if (Array.isArray(rows) && rows.length > 0 && rows[0].id_rol != null) {
        return rows[0].id_rol;
      }
    } catch (e: any) {
      throw new BadRequestException(`Error leyendo tabla "roles": ${e?.message ?? e}`);
    }

    // Si no existe el registro con nombre = 'EVALUADOR'
    throw new NotFoundException(
      'No se encontró el rol "EVALUADOR" en la tabla "roles". Verifica que exista ese registro.'
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
      throw new BadRequestException(`Áreas inexistentes: ${faltantes.join(', ')}`);
    }
  }

  /** POST /evaluadores */
  async create(dto: CreateEvaluadorDto & { nombreCompleto?: string; id_areas?: number[] }) {
    try {
      // normalizar nombre/apellido
      let { nombre, apellido } = dto as any;
      if ((!nombre || !apellido) && dto.nombreCompleto) {
        const p = dto.nombreCompleto.trim().split(/\s+/);
        if (p.length < 2) throw new BadRequestException('nombreCompleto debe incluir al menos nombre y apellido');
        if (p.length === 4) {
          nombre = p.slice(0, 2).join(' ');
          apellido = p.slice(2).join(' ');
        } else if (p.length === 3) {
          nombre = p[0];
          apellido = p.slice(1).join(' ');
        } else {
          nombre = p[0];
          apellido = p.slice(1).join(' ');
        }
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
      } = dto as any;

      const idRolEvaluador = await this.getEvaluadorRoleId();

      // duplicados
      if (correo) {
        const dupCorreo = await this.prisma.usuarios.findFirst({
          where: { correo },
          select: { id_usuario: true },
        });
        if (dupCorreo) throw new BadRequestException('El correo ya está registrado');
      }
      if (telefono) {
        const dupTel = await this.prisma.usuarios.findFirst({
          where: { telefono },
          select: { id_usuario: true },
        });
        if (dupTel) throw new BadRequestException('El teléfono ya está registrado');
      }
      if (ci) {
        const dupCi = await this.prisma.usuarios.findFirst({
          where: { ci },
          select: { id_usuario: true },
        });
        if (dupCi) throw new BadRequestException('El CI ya está registrado');
      }

      await this.assertAreasExisten(id_areas || []);

      const created = await this.prisma.usuarios.create({
        data: {
          nombre,
          apellido,
          correo,
          telefono,
          ci,
          institucion,
          especialidad,
          experiencia,
          activo: typeof activo === 'boolean' ? activo : true,
          hash_password: 'temporal', // cumple con tu esquema
          id_rol: idRolEvaluador,    // FK real en tu tabla usuarios
        },
        select: { id_usuario: true },
      });

      if (Array.isArray(id_areas) && id_areas.length > 0) {
        await this.prisma.evaluadores_area.createMany({
          data: id_areas.map((id_area: number) => ({
            id_usuario: created.id_usuario,
            id_area,
          })),
          skipDuplicates: true,
        });
      }

      return { ok: true, id_usuario: created.id_usuario };
    } catch (err: any) {
      console.error('ERROR create evaluador ->', {
        name: err?.name,
        code: err?.code,
        message: err?.message,
        meta: err?.meta,
        response: err?.response,
      });

      if (err instanceof PrismaClientKnownRequestError) {
        throw new BadRequestException(formatPrismaError(err));
      }
      if (err?.response?.message) throw err;
      throw new BadRequestException(formatPrismaError(err) || 'No se pudo registrar el evaluador');
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
}
