//src/olimpistas/olimpistas.service.ts
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
    const disponibles = all
      .map((n) => `${n.id_nivel}:${n.nombre_nivel}`)
      .join(', ');

    throw new BadRequestException(
      `Nivel no encontrado: "${raw}". Niveles disponibles en BD: [${disponibles}]`,
    );
  }

  private async getAreaNamesOfUser(userId: number): Promise<string[]> {
    const rows = await this.prisma.responsables_area.findMany({
      where: { id_usuario: userId, activo: true },
      include: { area: { select: { nombre_area: true } } },
    });
    return rows.map((r) => r.area.nombre_area);
  }

  private parseNivelFromColumn(rawNivel: string | undefined): {
    nivel: 'Primaria' | 'Secundaria';
    grado: number;
  } {
    if (!rawNivel) {
      throw new BadRequestException(
        'El campo "nivel" es obligatorio en el CSV.',
      );
    }

    const original = rawNivel;
    const compact = rawNivel.replace(/\s+/g, '').toLowerCase();
    const s = rawNivel.trim().toLowerCase();

    let m = /^(\d{1,2})(?:º)?([ps])$/.exec(compact);
    if (m) {
      const grado = Number(m[1]);
      if (grado < 1 || grado > 6) {
        throw new BadRequestException(
          `Grado inválido en nivel="${original}". Debe estar entre 1 y 6.`,
        );
      }
      const nivel =
        m[2].toLowerCase() === 'p'
          ? ('Primaria' as const)
          : ('Secundaria' as const);
      return { nivel, grado };
    }

    m =
      /^(\d{1,2})\s*(?:º|ro|do|to)?\s*(?:de\s+)?(primaria|secundaria|p|s)/i.exec(
        s,
      );
    if (m) {
      const grado = Number(m[1]);
      if (grado < 1 || grado > 6) {
        throw new BadRequestException(
          `Grado inválido en nivel="${original}". Debe estar entre 1 y 6.`,
        );
      }

      const tag = m[2].toLowerCase();
      const nivel =
        tag === 'primaria' || tag === 'p'
          ? ('Primaria' as const)
          : ('Secundaria' as const);

      return { nivel, grado };
    }

    if (s === 'primaria' || s === 'primaria.') {
      throw new BadRequestException(
        `El nivel "${original}" no especifica grado. Use por ejemplo "1ro Primaria".`,
      );
    }
    if (s === 'secundaria' || s === 'secundaria.') {
      throw new BadRequestException(
        `El nivel "${original}" no especifica grado. Use por ejemplo "1ro Secundaria".`,
      );
    }

    throw new BadRequestException(
      `Formato de nivel inválido: "${original}". Use formatos como "1ºP" o "1ro Primaria".`,
    );
  }

  private deriveEscolaridad(dto: RegistroOlimpistaDto): {
    nivel: 'Primaria' | 'Secundaria';
    grado?: number;
  } {
    // 1) Caso registro manual: ya vienen grado/gradoEscolar
    if (
      (dto.gradoEscolar && dto.gradoEscolar.trim().length > 0) ||
      typeof dto.grado === 'number'
    ) {
      const escolar = resolveNivelYGrado({
        nivelCompetidor:
          dto.nivelCompetidor ??
          (dto.nivel as 'Primaria' | 'Secundaria' | undefined),
        grado: dto.grado,
        gradoEscolar: dto.gradoEscolar,
      });

      if (!escolar.nivel) {
        throw new BadRequestException(
          `Nivel no encontrado: "${dto.nivel ?? dto.gradoEscolar ?? ''}"`,
        );
      }

      const nivelCanon =
        escolar.nivel === 'Primaria'
          ? ('Primaria' as const)
          : ('Secundaria' as const);
      const gradoCanon = escolar.grado;

      return { nivel: nivelCanon, grado: gradoCanon };
    }

    // 2) Caso CSV: solo viene dto.nivel
    const parsed = this.parseNivelFromColumn(dto.nivel);
    return parsed;
  }

  async existsByCi(ci: string): Promise<boolean> {
    if (!ci) return false;
    const found = await this.prisma.competidores.findFirst({
      where: { ci },
      select: { id_competidor: true },
    });
    return !!found;
  }

  async registerOne(dto: RegistroOlimpistaDto, _userId?: number) {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!gestion) throw new BadRequestException('No hay gestión abierta.');
    const idArea = await this.getAreaIdByName(dto.area);

    // Unifica lógica para manual + CSV
    const escolar = this.deriveEscolaridad(dto);
    const nivelCanon = escolar.nivel;
    const gradoCanon = escolar.grado;

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
        nivel:
          nivelCanon === 'Primaria'
            ? ('PRIMARIA' as const)
            : ('SECUNDARIA' as const),
        grado: gradoCanon ?? undefined,
      },
    });

    const insc = await this.prisma.inscripciones.findUnique({
      where: {
        uq_insc_unica_por_gestion: {
          id_competidor: competidor.id_competidor,
          id_area: idArea,
          id_nivel: idNivel,
          id_gestion: gestion.id_gestion, // <--- AGREGADO
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
          id_gestion: gestion.id_gestion,
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
        if (res.skippedInsc) {
          summary.skippedInsc++;
        } else {
          summary.createdInsc++;
        }
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
          const dto = rows[i];

          await this.getAreaIdByName(dto.area);

          const escolar = this.deriveEscolaridad(dto);

          await this.getNivelIdByName(escolar.nivel);

          splitNombreCompleto(dto.nombreCompleto);

          if (await this.existsByCi(dto.ci)) {
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
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    // Si no hay gestión abierta, devolvemos lista vacía
    if (!gestion) return [];
    const { area, q } = params ?? {};

    const where: Record<string, unknown> = {
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
        evaluaciones: { select: { nota: true } },
      },
      orderBy: { id_inscripcion: 'desc' },
    });

    return insc.map((it) => {
      const manual =
        it.puntaje_clasificacion !== null &&
        it.puntaje_clasificacion !== undefined
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
        nombreCompleto:
          `${it.competidor.nombres} ${it.competidor.apellidos}`.trim(),
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
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    const data = await this.prisma.areas.findMany({
      where: { activo: true },
      select: {
        nombre_area: true,
        _count: {
          select: {
            inscripciones: {
              // Si hay gestión, contamos solo las de este año. Si no, 0.
              where: gestion
                ? { id_gestion: gestion.id_gestion }
                : { id_gestion: -1 },
            },
          },
        },
      },
      orderBy: { nombre_area: 'asc' },
    });

    return data.map((a) => ({
      nombre_area: a.nombre_area,
      total: a._count.inscripciones,
    }));
  }
}
