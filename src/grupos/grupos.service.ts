// src/grupos/grupos.service.ts

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGrupoDto, MiembroGrupoDto } from './dto/create-grupo.dto';
import { splitNombreCompleto } from '../common/utils/name.util';
import { resolveNivelYGrado } from '../common/utils/grade.util';
import { NotFoundException } from '@nestjs/common';

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
            nombre: miembro.grupo.nombre_equipo, // ← mapeo aquí
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

  private async upsertCompetidorDesdeMiembro(
    m: MiembroGrupoDto,
    escuela: string,
    deptoFallback: string,
    grupoNivelString?: string,
  ) {
    const depto = m.departamento ?? deptoFallback;
    const { nombres, apellidos } = splitNombreCompleto(m.nombreCompleto);
    const escolar = resolveNivelYGrado({
      nivelCompetidor: m.nivelCompetidor as any,
      grado: m.grado as any,
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
    if (!dto.miembros?.length)
      throw new BadRequestException('El grupo debe tener al menos 1 miembro.');

    const [idArea, idNivel] = await Promise.all([
      this.getAreaIdByName(dto.area),
      this.getNivelIdByName(dto.nivel),
    ]);

    const fallbackGrupoNivel = dto.nivel;

    const grupo = await this.prisma.grupos.upsert({
      where: {
        uq_grupo_unico: {
          nombre_equipo: dto.nombreEquipo,
          id_area: idArea,
          id_nivel: idNivel,
          escuela: dto.unidadEducativa,
        },
      },
      update: {
        departamento: dto.departamento,
        created_by: userId,
      },
      create: {
        nombre_equipo: dto.nombreEquipo,
        escuela: dto.unidadEducativa,
        departamento: dto.departamento,
        id_area: idArea,
        id_nivel: idNivel,
        created_by: userId,
      },
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
            uq_insc_unica: {
              id_competidor: c.id_competidor,
              id_area: idArea,
              id_nivel: idNivel,
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
          } catch (e: any) {
            // Si otra petición ganó la carrera y violó la unique:
            if (
              e.code === 'P2002' &&
              String(e.meta?.target || '').includes(
                'uq_competidor_en_un_solo_grupo',
              )
            ) {
              throw new BadRequestException(
                'El olimpista ya pertenece a un grupo existente.',
              );
            }
            throw e;
          }
        } else {
          summary.skippedLink++;
        }

        summary.ok++;
      } catch (e: any) {
        summary.errors.push(
          `Miembro ${i + 1} (ci=${m?.ci}): ${e?.message ?? 'Error'}`,
        );
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
