// src/grupos/grupos.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGrupoDto, MiembroGrupoDto } from './dto/create-grupo.dto';
import { splitNombreCompleto } from '../common/utils/name.util';
import { resolveNivelYGrado } from '../common/utils/grade.util';
import { Prisma } from '@prisma/client';
// Importamos el tipo de error específico de Prisma
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class GruposService {
  constructor(private prisma: PrismaService) {}

  async checkMiembroPorCI(ci: string) {
    const comp = await this.prisma.competidores.findFirst({
      where: { ci },
      select: { id_competidor: true, nombres: true, apellidos: true },
    });

    if (!comp) {
      return { exists: false, inGroup: false, group: null };
    }

    const miembro = await this.prisma.grupo_miembros.findFirst({
      where: { id_competidor: comp.id_competidor },
      select: {
        id_grupo_miembro: true,
        id_grupo: true,
        grupo: {
          select: {
            id_grupo: true,
            nombre_equipo: true,
            escuela: true,
            departamento: true,
            id_area: true,
            id_nivel: true,
          },
        },
      },
    });

    return {
      exists: true,
      inGroup: Boolean(miembro),
      competitor: comp,
      group: miembro
        ? {
            id_grupo: miembro.grupo.id_grupo,
            nombre: miembro.grupo.nombre_equipo,
            escuela: miembro.grupo.escuela,
            departamento: miembro.grupo.departamento,
            id_area: miembro.grupo.id_area,
            id_nivel: miembro.grupo.id_nivel,
          }
        : null,
    };
  }

  private async getAreaIdByName(nombre: string): Promise<number> {
    const area = await this.prisma.areas.findFirst({
      where: {
        nombre_area: { equals: nombre, mode: 'insensitive' },
        activo: true,
      },
      select: { id_area: true },
    });
    if (!area)
      throw new BadRequestException(
        `Área no encontrada o inactiva: "${nombre}"`,
      );
    return area.id_area;
  }

  private async getNivelIdByName(nombre: string): Promise<number> {
    const nivel = await this.prisma.niveles.findFirst({
      where: { nombre_nivel: { equals: nombre, mode: 'insensitive' } },
      select: { id_nivel: true },
    });
    if (!nivel)
      throw new BadRequestException(`Nivel no encontrado: "${nombre}"`);
    return nivel.id_nivel;
  }

  private async resolveTutorId(dto: CreateGrupoDto): Promise<number | null> {
    if (dto.tutorId) {
      const exists = await this.prisma.tutores.findUnique({
        where: { id_tutor: dto.tutorId },
        select: { id_tutor: true },
      });
      if (!exists) {
        throw new BadRequestException(`Tutor con id ${dto.tutorId} no existe`);
      }
      return dto.tutorId;
    }

    if (dto.tutorTelefono) {
      const found = await this.prisma.tutores.findUnique({
        where: { telefono: dto.tutorTelefono },
        select: { id_tutor: true },
      });
      if (found) return found.id_tutor;

      if (dto.tutorPayload) {
        if (!dto.tutorPayload.telefono) {
          throw new BadRequestException(
            'tutorPayload.telefono es requerido para crear el tutor.',
          );
        }
        if (dto.tutorPayload.telefono !== dto.tutorTelefono) {
          throw new BadRequestException(
            'tutorPayload.telefono debe coincidir con tutorTelefono.',
          );
        }

        const upserted = await this.prisma.tutores.upsert({
          where: { telefono: dto.tutorTelefono },
          create: {
            nombre_completo: dto.tutorPayload.nombreCompleto,
            ci: dto.tutorPayload.ci ?? null,
            correo: dto.tutorPayload.correo ?? null,
            telefono: dto.tutorPayload.telefono,
            unidad_educativa: dto.tutorPayload.unidadEducativa ?? null,
          },
          update: {
            nombre_completo: dto.tutorPayload.nombreCompleto,
            ci: dto.tutorPayload.ci ?? null,
            correo: dto.tutorPayload.correo ?? null,
            unidad_educativa: dto.tutorPayload.unidadEducativa ?? null,
          },
          select: { id_tutor: true },
        });
        return upserted.id_tutor;
      }

      throw new BadRequestException(
        `No existe tutor con teléfono ${dto.tutorTelefono}`,
      );
    }

    if (dto.tutorPayload) {
      if (!dto.tutorPayload.telefono) {
        throw new BadRequestException(
          'tutorPayload.telefono es requerido para crear el tutor.',
        );
      }
      const upserted = await this.prisma.tutores.upsert({
        where: { telefono: dto.tutorPayload.telefono },
        create: {
          nombre_completo: dto.tutorPayload.nombreCompleto,
          ci: dto.tutorPayload.ci ?? null,
          correo: dto.tutorPayload.correo ?? null,
          telefono: dto.tutorPayload.telefono,
          unidad_educativa: dto.tutorPayload.unidadEducativa ?? null,
        },
        update: {
          nombre_completo: dto.tutorPayload.nombreCompleto,
          ci: dto.tutorPayload.ci ?? null,
          correo: dto.tutorPayload.correo ?? null,
          unidad_educativa: dto.tutorPayload.unidadEducativa ?? null,
        },
        select: { id_tutor: true },
      });
      return upserted.id_tutor;
    }

    return null;
  }

  private async upsertCompetidorDesdeMiembro(
    m: MiembroGrupoDto,
    escuela: string,
    deptoFallback: string,
    grupoNivelString?: string,
  ) {
    const depto = m.departamento ?? deptoFallback;
    const { nombres, apellidos } = splitNombreCompleto(m.nombreCompleto);
    // 1️⃣ Corrección: Quitamos 'as any'. Si resolveNivelYGrado acepta los tipos del DTO, esto funcionará.
    const escolar = resolveNivelYGrado({
      nivelCompetidor: m.nivelCompetidor,
      grado: m.grado,
      gradoEscolar: m.gradoEscolar,
      grupoNivelString,
    });

    const existing = await this.prisma.competidores.findFirst({
      where: { ci: m.ci },
    });

    return existing
      ? this.prisma.competidores.update({
          where: { id_competidor: existing.id_competidor },
          data: {
            nombres,
            apellidos,
            escuela,
            departamento: depto,
            tutorContacto: m.tutorContacto,
            nivel: escolar.nivel
              ? escolar.nivel === 'Primaria'
                ? 'PRIMARIA'
                : 'SECUNDARIA'
              : undefined,
            grado: escolar.grado ?? undefined,
          },
          select: { id_competidor: true },
        })
      : this.prisma.competidores.create({
          data: {
            ci: m.ci,
            nombres,
            apellidos,
            escuela,
            departamento: depto,
            tutorContacto: m.tutorContacto,
            nivel: escolar.nivel
              ? escolar.nivel === 'Primaria'
                ? 'PRIMARIA'
                : 'SECUNDARIA'
              : undefined,
            grado: escolar.grado ?? undefined,
            activo: true,
          },
          select: { id_competidor: true },
        });
  }

  async registerGrupo(dto: CreateGrupoDto, userId?: number) {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!gestion)
      throw new BadRequestException(
        'No hay gestión abierta para inscribir grupos.',
      );
    if (!dto.miembros || dto.miembros.length < 2) {
      throw new BadRequestException('El grupo debe tener al menos 2 miembros.');
    }

    const [idArea, idNivel] = await Promise.all([
      this.getAreaIdByName(dto.area),
      this.getNivelIdByName(dto.nivel),
    ]);
    const idTutor = await this.resolveTutorId(dto);
    if (!idTutor)
      throw new BadRequestException(
        'El grupo debe estar vinculado a un tutor.',
      );

    const fallbackGrupoNivel = dto.nivel;
    const updateData: Prisma.gruposUpdateInput = {
      departamento: dto.departamento,
      created_by: userId ?? null,
      area: { connect: { id_area: idArea } },
      nivel: { connect: { id_nivel: idNivel } },
      ...(idTutor
        ? { tutor: { connect: { id_tutor: idTutor } } }
        : { tutor: { disconnect: true } }),
    };

    const createData: Prisma.gruposCreateInput = {
      nombre_equipo: dto.nombreEquipo,
      escuela: dto.unidadEducativa,
      departamento: dto.departamento,
      created_by: userId ?? null,
      area: { connect: { id_area: idArea } },
      nivel: { connect: { id_nivel: idNivel } },
      ...(idTutor ? { tutor: { connect: { id_tutor: idTutor } } } : {}),
    };

    const grupo = await this.prisma.grupos.upsert({
      where: {
        uq_grupo_unico: {
          nombre_equipo: dto.nombreEquipo,
          id_area: idArea,
          id_nivel: idNivel,
          escuela: dto.unidadEducativa,
        },
      },
      update: updateData,
      create: createData,
      select: { id_grupo: true },
    });

    const summary = {
      total: dto.miembros.length,
      ok: 0,
      createdInsc: 0,
      skippedInsc: 0,
      linked: 0,
      skippedLink: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < dto.miembros.length; i++) {
      const m = dto.miembros[i];
      try {
        const c = await this.upsertCompetidorDesdeMiembro(
          m,
          dto.unidadEducativa,
          dto.departamento,
          fallbackGrupoNivel,
        );

        const insc = await this.prisma.inscripciones.findUnique({
          where: {
            uq_insc_unica_por_gestion: {
              id_competidor: c.id_competidor,
              id_area: idArea,
              id_nivel: idNivel,
              id_gestion: gestion.id_gestion,
            },
          },
          select: { id_inscripcion: true },
        });

        if (!insc) {
          await this.prisma.inscripciones.create({
            data: {
              id_competidor: c.id_competidor,
              id_area: idArea,
              id_nivel: idNivel,
              id_gestion: gestion.id_gestion,
              estado_inscripcion: 'INSCRITO',
            },
          });
          summary.createdInsc++;
        } else {
          summary.skippedInsc++;
        }

        const miembroEnOtro = await this.prisma.grupo_miembros.findFirst({
          where: { id_competidor: c.id_competidor },
          select: {
            id_grupo: true,
            grupo: { select: { id_grupo: true, nombre_equipo: true } },
          },
        });

        if (miembroEnOtro && miembroEnOtro.grupo.id_grupo !== grupo.id_grupo) {
          throw new BadRequestException(
            `El olimpista con CI ${m.ci} ya pertenece al grupo “${miembroEnOtro.grupo.nombre_equipo}”.`,
          );
        }

        const existingLink = await this.prisma.grupo_miembros.findFirst({
          where: { id_grupo: grupo.id_grupo, id_competidor: c.id_competidor },
          select: { id_grupo_miembro: true },
        });

        if (!existingLink) {
          try {
            await this.prisma.grupo_miembros.create({
              data: {
                id_grupo: grupo.id_grupo,
                id_competidor: c.id_competidor,
                rol: 'MIEMBRO',
              },
            });
            summary.linked++;
          } catch (e: unknown) {
            if (
              e instanceof PrismaClientKnownRequestError &&
              e.code === 'P2002'
            ) {
              // ✅ CORRECCIÓN AQUÍ: Usamos JSON.stringify para evitar el error de ESLint
              const targetStr = JSON.stringify(e.meta?.target || '');
              if (targetStr.includes('uq_competidor_en_un_solo_grupo')) {
                throw new BadRequestException(
                  'El olimpista ya pertenece a un grupo existente.',
                );
              }
            }
            throw e;
          }
        } else {
          summary.skippedLink++;
        }

        summary.ok++;
      } catch (e: unknown) {
        const errorMessage =
          e instanceof Error ? e.message : 'Error desconocido';
        summary.errors.push(`Miembro ${i + 1} (ci=${m?.ci}): ${errorMessage}`);
      }
    }

    return {
      grupoId: grupo.id_grupo,
      area: dto.area,
      nivel: dto.nivel,
      ...summary,
    };
  }

  async getGrupoDetalle(id_grupo: number) {
    const g = await this.prisma.grupos.findUnique({
      where: { id_grupo },
      include: {
        area: { select: { nombre_area: true } },
        nivel: { select: { nombre_nivel: true } },
        tutor: {
          select: {
            id_tutor: true,
            nombre_completo: true,
            telefono: true,
            correo: true,
          },
        },
        miembros: {
          include: {
            competidor: {
              select: {
                id_competidor: true,
                nombres: true,
                apellidos: true,
                ci: true,
                nivel: true,
                grado: true,
              },
            },
          },
        },
      },
    });
    if (!g) throw new NotFoundException('Grupo no encontrado');
    return g;
  }
}
