// src/olimpistas/olimpistas.service.ts

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegistroOlimpistaDto } from './dto/registro-olimpista.dto';
import { splitNombreCompleto } from '../common/utils/name.util';
import { parseCsvToDtos } from '../common/utils/csv.util';
import { resolveNivelYGrado } from '../common/utils/grade.util';

type ImportOptions = { userId?: number; dryRun?: boolean };

@Injectable()
export class OlimpistasService {
  constructor(private prisma: PrismaService) {}

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

  async registerOne(dto: RegistroOlimpistaDto, userId?: number) {
    const [idArea, idNivel] = await Promise.all([
      this.getAreaIdByName(dto.area),
      this.getNivelIdByName(dto.nivel),
    ]);

    const { nombres, apellidos } = splitNombreCompleto(dto.nombreCompleto);

    const existing = await this.prisma.competidores.findFirst({
      where: { ci: dto.ci },
    });

    const escolar = resolveNivelYGrado({
      nivelCompetidor: dto.nivelCompetidor as any,
      grado: dto.grado as any,
      gradoEscolar: dto.gradoEscolar,
    });

    const competidor = existing
      ? await this.prisma.competidores.update({
          where: { id_competidor: existing.id_competidor },
          data: {
            nombres,
            apellidos,
            escuela: dto.unidadEducativa,
            departamento: dto.departamento,
            tutorContacto: dto.tutorContacto,
            nivel: escolar.nivel
              ? escolar.nivel === 'Primaria'
                ? 'PRIMARIA'
                : 'SECUNDARIA'
              : undefined,
            grado: escolar.grado ?? undefined,
          },
        })
      : await this.prisma.competidores.create({
          data: {
            ci: dto.ci,
            nombres,
            apellidos,
            escuela: dto.unidadEducativa,
            departamento: dto.departamento,
            tutorContacto: dto.tutorContacto,
            activo: true,
            nivel: escolar.nivel
              ? escolar.nivel === 'Primaria'
                ? 'PRIMARIA'
                : 'SECUNDARIA'
              : undefined,
            grado: escolar.grado ?? undefined,
          },
        });

    const insc = await this.prisma.inscripciones.findUnique({
      where: {
        uq_insc_unica: {
          id_competidor: competidor.id_competidor,
          id_area: idArea,
          id_nivel: idNivel,
        },
      },
      select: { id_inscripcion: true },
    });

    if (!insc) {
      await this.prisma.inscripciones.create({
        data: {
          id_competidor: competidor.id_competidor,
          id_area: idArea,
          id_nivel: idNivel,
          estado_inscripcion: 'INSCRITO',
          observaciones: null,
        },
      });
      return {
        created: true,
        skippedInsc: false,
        competidorId: competidor.id_competidor,
        area: dto.area,
        nivel: dto.nivel,
      };
    }

    return {
      created: false,
      skippedInsc: true,
      competidorId: competidor.id_competidor,
      area: dto.area,
      nivel: dto.nivel,
    };
  }

  async registerMany(list: RegistroOlimpistaDto[], userId?: number) {
    if (!list?.length) throw new BadRequestException('Lista vacía.');
    const summary = {
      total: list.length,
      ok: 0,
      createdInsc: 0,
      skippedInsc: 0,
      errors: [] as string[],
    };
    for (let i = 0; i < list.length; i++) {
      try {
        const res = await this.registerOne(list[i], userId);
        summary.ok++;
        res.skippedInsc ? summary.skippedInsc++ : summary.createdInsc++;
      } catch (e: any) {
        summary.errors.push(
          `Fila ${i + 1} (ci=${list[i]?.ci}): ${e?.message ?? 'Error'}`,
        );
      }
    }
    return summary;
  }

  async registerCsv(
    buffer: Buffer,
    originalName: string,
    opts: ImportOptions = {},
  ) {
    const rows = await parseCsvToDtos(buffer);

    const required = [
      'nombreCompleto',
      'ci',
      'tutorContacto',
      'unidadEducativa',
      'departamento',
      'gradoEscolar',
      'area',
      'nivel',
    ];
    const missingColumns = required.filter(
      (k) => !Object.keys(rows[0] ?? {}).includes(k),
    );
    if (missingColumns.length) {
      throw new BadRequestException(
        `Faltan columnas: ${missingColumns.join(', ')}`,
      );
    }

    if (opts.dryRun) {
      const summary = {
        total: rows.length,
        ok: 0,
        createdInsc: 0,
        skippedInsc: 0,
        errors: [] as string[],
      };
      for (let i = 0; i < rows.length; i++) {
        try {
          await this.getAreaIdByName(rows[i].area);
          await this.getNivelIdByName(rows[i].nivel);
          splitNombreCompleto(rows[i].nombreCompleto);
          summary.ok++;
        } catch (e: any) {
          summary.errors.push(
            `Fila ${i + 1} (ci=${rows[i]?.ci}): ${e?.message ?? 'Error'}`,
          );
        }
      }
      return { ...summary, dryRun: true };
    }

    const summary = await this.registerMany(rows, opts.userId);

    await this.prisma.import_csv.create({
      data: {
        archivo_nombre: originalName,
        total_registros: summary.total,
        ok: summary.ok,
        con_error: summary.errors.length,
        mapeo_campos: { by: 'name', required },
        ejecutado_por: opts.userId ?? 0,
        detalle_errores: summary.errors.length ? summary.errors : undefined,
      },
    });

    return summary;
  }

  /**
   * GET /olimpistas
   * Devuelve filas normalizadas para el FE:
   * id, nombreCompleto, area, nivel, puntuacion(null), unidadEducativa, departamento
   */
  async listOlimpistas(params: { area?: string; q?: string }) {
    const { area, q } = params ?? {};

    const where: any = {
      ...(area
        ? { area: { nombre_area: { equals: area, mode: 'insensitive' } } }
        : {}),
      ...(q
        ? {
            OR: [
              { competidor: { nombres: { contains: q, mode: 'insensitive' } } },
              {
                competidor: { apellidos: { contains: q, mode: 'insensitive' } },
              },
              { competidor: { escuela: { contains: q, mode: 'insensitive' } } },
              {
                competidor: {
                  departamento: { contains: q, mode: 'insensitive' },
                },
              },
              { competidor: { ci: { contains: q, mode: 'insensitive' } } },
              { area: { nombre_area: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const insc = await this.prisma.inscripciones.findMany({
      where,
      include: {
        competidor: true,
        area: true,
        nivel: true,
      },
      orderBy: { id_inscripcion: 'desc' },
    });

    const rows = insc.map((it) => ({
      id: it.id_inscripcion,
      nombreCompleto:
        `${it.competidor.nombres} ${it.competidor.apellidos}`.trim(),
      area: it.area.nombre_area,
      nivel: it.nivel.nombre_nivel,
      puntuacion: null as number | null,
      unidadEducativa: it.competidor.escuela ?? '',
      departamento: it.competidor.departamento ?? '',
    }));

    return rows;
  }

  /**
   * GET /olimpistas/areas-counters
   * Devuelve [{ nombre_area, total }]
   */
  async getAreasCounters() {
    const data = await this.prisma.areas.findMany({
      where: { activo: true },
      select: {
        nombre_area: true,
        _count: { select: { inscripciones: true } },
      },
      orderBy: { nombre_area: 'asc' },
    });

    return data.map((a) => ({
      nombre_area: a.nombre_area,
      total: a._count.inscripciones,
    }));
  }
}
