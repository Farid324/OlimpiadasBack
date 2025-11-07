import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegistroOlimpistaDto } from './dto/registro-olimpista.dto';
import { splitNombreCompleto } from '../common/utils/name.util';
import { parseCsvToDtos } from '../common/utils/csv.util';
import { resolveNivelYGrado } from '../common/utils/grade.util';

type ImportOptions = { userId?: number; dryRun?: boolean };

type ListParams = {
  area?: string;
  q?: string;
  /** Si viene un userId, se restringe a sus áreas (para RESPONSABLE_DE_AREA) */
  //limitToUserAreasOf?: number | null;
};

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
    const raw = (nombre ?? '').toString();
    const s = raw.trim().toLowerCase();

    const canon =
      s === 'primaria'
        ? 'Primaria'
        : s === 'secundaria'
        ? 'Secundaria'
        : s === 'primaria '
        ? 'Primaria'
        : s === ' secundaria'
        ? 'Secundaria'
        : s === 'primaria.'
        ? 'Primaria'
        : s === 'secundaria.'
        ? 'Secundaria'
        : null;

    if (canon) {
      const nivel = await this.prisma.niveles.findFirst({
        where: { nombre_nivel: { equals: canon, mode: 'insensitive' } },
        select: { id_nivel: true, nombre_nivel: true },
      });
      if (nivel) {
        return nivel.id_nivel;
      }
    }

    const nivelAlt = await this.prisma.niveles.findFirst({
      where: { nombre_nivel: { contains: s, mode: 'insensitive' } },
      select: { id_nivel: true, nombre_nivel: true },
    });
    if (nivelAlt) {
      return nivelAlt.id_nivel;
    }

    const all = await this.prisma.niveles.findMany({
      select: { id_nivel: true, nombre_nivel: true },
      orderBy: { id_nivel: 'asc' },
    });
    const disponibles = all.map((n) => `${n.id_nivel}:${n.nombre_nivel}`).join(', ');

    throw new BadRequestException(
      `Nivel no encontrado: "${raw}". Niveles disponibles en BD: [${disponibles}]`,
    );
  }

  // Áreas asignadas a un responsable
  private async getAreaNamesOfUser(userId: number): Promise<string[]> {
    const rows = await this.prisma.responsables_area.findMany({
      where: { id_usuario: userId, activo: true },
      include: { area: { select: { nombre_area: true } } },
    });
    return rows.map((r) => r.area.nombre_area);
  }

  async existsByCi(ci: string): Promise<boolean> {
    if (!ci) return false;
    const found = await this.prisma.competidores.findFirst({
      where: { ci },
      select: { id_competidor: true },
    });
    return !!found;
  }

  async registerOne(dto: RegistroOlimpistaDto, userId?: number) {
    const idArea = await this.getAreaIdByName(dto.area);

    const escolar = resolveNivelYGrado({
      nivelCompetidor: dto.nivel as any,
      grado: dto.grado as any,
      gradoEscolar: dto.gradoEscolar,
    });

    let nivelCanon = escolar.nivel as 'Primaria' | 'Secundaria' | undefined;
    let gradoCanon: number | undefined = escolar.grado ?? dto.grado;

    if (!nivelCanon && typeof dto.nivel === 'string') {
      const m = /(\d+)\s*º\s*([pPsS])/.exec(dto.nivel.trim());
      if (m) {
        gradoCanon = Number(m[1]);
        nivelCanon = m[2].toLowerCase() === 'p' ? 'Primaria' : 'Secundaria';
      }
    }

    if (!nivelCanon) {
      throw new BadRequestException(
        `Nivel no encontrado: "${dto.nivel ?? dto.gradoEscolar ?? ''}"`,
      );
    }
    const idNivel = await this.getNivelIdByName(nivelCanon);

    const { nombres, apellidos } = splitNombreCompleto(dto.nombreCompleto);

    const duplicado = await this.existsByCi(dto.ci);
    if (duplicado) {
      throw new BadRequestException('El CI ya está registrado');
    }

    const tutor = await this.prisma.tutores.findUnique({
      where: { telefono: dto.tutorContacto },
      select: { id_tutor: true },
    });

    if (!tutor) {
      throw new BadRequestException(
        'Debe registrar un tutor antes de asociar un olimpista.',
      );
    }

    const ueNorm = (dto.unidadEducativa || '').trim().replace(/\s+/g, ' ');

    const competidor = await this.prisma.competidores.create({
      data: {
        ci: dto.ci,
        nombres,
        apellidos,
        escuela: ueNorm,
        departamento: dto.departamento,
        tutorContacto: dto.tutorContacto,
        id_tutor: tutor.id_tutor,
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
        nivel: nivelCanon,
      };
    }

    return {
      created: true,
      skippedInsc: true,
      competidorId: competidor.id_competidor,
      area: dto.area,
      nivel: nivelCanon,
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
      } catch (e: unknown) {
        const ci = list[i]?.ci ?? 's/n';
        const msg = e instanceof Error ? e.message : 'Error';
        summary.errors.push(`Fila ${i + 1} (ci=${ci}): ${msg}`);
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
          if (await this.existsByCi(rows[i].ci)) {
            throw new BadRequestException('El CI ya está registrado');
          }
          summary.ok++;
        } catch (e: unknown) {
          const ci = rows[i]?.ci ?? 's/n';
          const msg = e instanceof Error ? e.message : 'Error';
          summary.errors.push(`Fila ${i + 1} (ci=${ci}): ${msg}`);
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
   * - puntuacion: puntaje_clasificacion o promedio de evaluaciones.nota
   * - si limitToUserAreasOf llega con userId => restringe a sus áreas
   */
  // ✅ Sin restricciones por área para ningún rol
async listOlimpistas(params: ListParams) {
  const { area, q } = params ?? {};

  const where: Record<string, unknown> = {
    ...(area
      ? { area: { nombre_area: { equals: area, mode: 'insensitive' } } }
      : {}),
    ...(q
      ? {
          OR: [
            { competidor: { nombres: { contains: q, mode: 'insensitive' } } },
            { competidor: { apellidos: { contains: q, mode: 'insensitive' } } },
            { competidor: { escuela: { contains: q, mode: 'insensitive' } } },
            { competidor: { departamento: { contains: q, mode: 'insensitive' } } },
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
      evaluaciones: { select: { nota: true } },
    },
    orderBy: { id_inscripcion: 'desc' },
  });

  return insc.map((it) => {
    const manual =
      it.puntaje_clasificacion !== null && it.puntaje_clasificacion !== undefined
        ? Number(it.puntaje_clasificacion)
        : null;

    const avg =
      !manual && it.evaluaciones.length
        ? it.evaluaciones.reduce((s, e) => s + Number(e.nota), 0) /
          it.evaluaciones.length
        : null;

    const puntuacion = manual ?? avg ?? null;

    return {
      id: it.id_inscripcion,
      nombreCompleto: `${it.competidor.nombres} ${it.competidor.apellidos}`.trim(),
      area: it.area.nombre_area,
      nivel: it.nivel.nombre_nivel,
      puntuacion,
      unidadEducativa: it.competidor.escuela ?? '',
      departamento: it.competidor.departamento ?? '',
    };
  });
}


  /**
   * GET /olimpistas/areas-counters
   * - si llega userId => restringe a sus áreas
   */
  // ✅ Contadores sin restricciones por área
async getAreasCounters(_limitToUserAreasOf: number | null = null) {
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
