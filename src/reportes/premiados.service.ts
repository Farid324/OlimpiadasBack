// src/reportes/premiados.service.ts
import {
  HttpException,
  HttpStatus,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FasesService } from '../fases/fases.service';
import { PhaseType } from '../fases/dto/close-phase.dto';
import { tipo_lista, fuente_lista, Prisma } from '@prisma/client';

type EstadoMedalla = 'ORO' | 'PLATA' | 'BRONCE' | 'MENCION';

interface FiltrosPremiados {
  id_area?: number;
  id_nivel?: number;
  estado?: EstadoMedalla;
  actorId?: number;
}

type PremiadoRow = {
  id_inscripcion: number;
  posicion: number;
  nombreCompleto: string;
  premio: string;
  estadoPremio: EstadoMedalla;
  area: string;
  nivel: string;
  puntuacion: number;
  unidadEducativa: string;
  departamento: string;
};

@Injectable()
export class PremiadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fases: FasesService,
  ) {}

  // ---------- helpers ----------
  private async getFinalPhaseId(): Promise<number> {
    const fase = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'FINAL' },
      select: { id_fase: true },
    });
    if (!fase) {
      throw new HttpException(
        'No está configurada la fase FINAL.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return fase.id_fase;
  }

  private medallaDePosicion(
    pos: number,
    cfg: { oro: number; plata: number; bronce: number; menciones: number },
  ): { tipo: EstadoMedalla | null; etiqueta: string | null } {
    if (pos <= cfg.oro) return { tipo: 'ORO', etiqueta: 'Medalla de Oro' };
    if (pos <= cfg.oro + cfg.plata)
      return { tipo: 'PLATA', etiqueta: 'Medalla de Plata' };
    if (pos <= cfg.oro + cfg.plata + cfg.bronce)
      return { tipo: 'BRONCE', etiqueta: 'Medalla de Bronce' };
    if (pos <= cfg.oro + cfg.plata + cfg.bronce + cfg.menciones)
      return { tipo: 'MENCION', etiqueta: 'Mención' };
    return { tipo: null, etiqueta: null };
  }

  // construye la lista solo para un area+nivel que ya sabemos que esta validado
  private async buildListForPair(
    id_area: number,
    id_nivel: number,
  ): Promise<PremiadoRow[]> {
    const id_fase_final = await this.getFinalPhaseId();

    // Gestión actual
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      orderBy: { created_at: 'desc' },
    });
    if (!gestion) {
      throw new BadRequestException(
        'No hay gestión abierta para generar premiados.',
      );
    }

    // 0) Nota mínima de aprobación (configuración de área)
    const areaCfg = await this.prisma.areas.findUnique({
      where: { id_area },
      select: {
        nota_aprobacion: true,
        nota_aprobacion_final: true,
      },
    });

    // Si en el futuro subes de 51 a 60, este valor se actualiza solo leyendo la config
    const minScore =
      areaCfg?.nota_aprobacion_final ?? areaCfg?.nota_aprobacion ?? 51;

    // 1) Medallero del área/nivel/gestión
    const medallero = await this.prisma.medallero_config.findFirst({
      where: {
        id_area,
        id_nivel,
        id_gestion: gestion.id_gestion,
      },
      orderBy: { id_medallero: 'desc' },
    });

    const cfg = {
      oro: medallero?.oros ?? 1,
      plata: medallero?.platas ?? 1,
      bronce: medallero?.bronces ?? 1,
      menciones: medallero?.menciones ?? 0,
    };

    // 2) Inscripciones del área/nivel/gestión
    const inscripciones = await this.prisma.inscripciones.findMany({
      where: {
        id_area,
        id_nivel,
        id_gestion: gestion.id_gestion,
      },
      include: {
        competidor: true,
        area: true,
        nivel: true,
      },
    });

    if (inscripciones.length === 0) return [];

    const ids = inscripciones.map((i) => i.id_inscripcion);

    // 3) Sacar promedio de evaluaciones finales firmadas
    const evals = await this.prisma.evaluaciones.groupBy({
      by: ['id_inscripcion'],
      where: {
        id_inscripcion: { in: ids },
        id_fase: id_fase_final,
        estado_registro: 'FIRMADA',
      },
      _avg: {
        nota: true,
      },
    });

    const scoreMap = new Map<number, number>();
    for (const e of evals) {
      scoreMap.set(e.id_inscripcion, Number(e._avg.nota ?? 0));
    }

    const ordenados = [...inscripciones]
      .map((insc) => {
        const dbScore = insc.puntaje_final ? Number(insc.puntaje_final) : null;
        const calcScore = scoreMap.get(insc.id_inscripcion) ?? null;
        const score = dbScore ?? calcScore;

        return {
          inscripcion: insc,
          score,
        };
      })
      .filter((x) => typeof x.score === 'number' && !Number.isNaN(x.score))
      .sort(
        (a, b) =>
          (b.score as number) - (a.score as number) ||
          a.inscripcion.id_inscripcion - b.inscripcion.id_inscripcion,
      );

    if (ordenados.length === 0) return [];

    // 5) Asignar medallas SOLO a quienes cumplen la nota mínima
    const salida: PremiadoRow[] = [];
    let pos = 0;

    for (const item of ordenados) {
      const { inscripcion, score } = item;
      const numericScore = Number(score);

      if (Number.isNaN(numericScore)) continue;

      // Filtrar por nota mínima de aprobación
      if (numericScore < minScore) {
        continue;
      }

      // La posición solo cuenta entre los que cumplen la nota mínima
      pos += 1;

      const med = this.medallaDePosicion(pos, cfg);
      if (!med.tipo) continue;

      salida.push({
        id_inscripcion: inscripcion.id_inscripcion,
        posicion: pos,
        nombreCompleto:
          `${inscripcion.competidor.nombres} ${inscripcion.competidor.apellidos}`.trim(),
        premio: med.etiqueta ?? '',
        estadoPremio: med.tipo,
        area: inscripcion.area.nombre_area,
        nivel: inscripcion.nivel.nombre_nivel,
        puntuacion: numericScore,
        unidadEducativa: inscripcion.competidor.escuela ?? '',
        departamento: inscripcion.competidor.departamento ?? '',
      });
    }

    return salida;
  }

  // ---------- APIs usadas por el controller ----------

  async list(f: FiltrosPremiados) {
    // si viene área+nivel, validar fase FINAL
    if (f.id_area && f.id_nivel) {
      const st = await this.fases.getStatus(
        f.id_area,
        f.id_nivel,
        PhaseType.FINAL,
      );
      if (st !== 'VALIDADA') {
        // HU-012: mensaje exacto
        throw new HttpException(
          'No es posible publicar los resultados: la fase no ha sido avalada.',
          HttpStatus.LOCKED,
        );
      }
      const datos = await this.buildListForPair(f.id_area, f.id_nivel);

      const filtrados = f.estado
        ? datos.filter((d) => d.estadoPremio === f.estado)
        : datos;

      // registrar que se generó una lista (log muy simple)
      if (f.actorId) {
        // 1️⃣ NUEVO: Obtener gestión para el log
        const gestion = await this.prisma.gestiones.findFirst({
          where: { estado: 'ABIERTA' },
        });

        if (gestion) {
          await this.prisma.listas_generadas.create({
            data: {
              tipo_lista: tipo_lista.PREMIADOS,
              id_area: f.id_area,
              id_nivel: f.id_nivel,
              id_gestion: gestion.id_gestion, // <--- ⚠️ AGREGADO
              fuente: fuente_lista.FINAL,
              criterios_orden: {},
              contenido_snapshot: filtrados as unknown as Prisma.InputJsonValue,
              generado_por: f.actorId,
            },
          });
        }
      }

      return filtrados;
    }

    // si no viene area+nivel entonces devolver para todos los pares validados
    const id_fase_final = await this.getFinalPhaseId();

    // Gestión actual
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      orderBy: { created_at: 'desc' },
    });

    const cierres = await this.prisma.cierres_fase.findMany({
      where: {
        id_fase: id_fase_final,
        estado_validacion: 'VALIDADO',
        ...(gestion ? { id_gestion: gestion.id_gestion } : {}),
      },
      select: { id_area: true, id_nivel: true },
    });

    const all: PremiadoRow[] = [];
    for (const c of cierres) {
      const parcial = await this.buildListForPair(c.id_area, c.id_nivel);
      all.push(...parcial);
    }

    return all;
  }

  async resumen(f: { id_area?: number; id_nivel?: number }) {
    const lista = await this.list({ ...f });
    const counts = {
      oro: 0,
      plata: 0,
      bronce: 0,
      menciones: 0,
      totalPremiados: lista.length,
    };
    for (const it of lista) {
      if (it.estadoPremio === 'ORO') counts.oro += 1;
      else if (it.estadoPremio === 'PLATA') counts.plata += 1;
      else if (it.estadoPremio === 'BRONCE') counts.bronce += 1;
      else if (it.estadoPremio === 'MENCION') counts.menciones += 1;
    }
    return counts;
  }

  async buildHtmlTable(f: { id_area?: number; id_nivel?: number }) {
    const lista = await this.list({ ...f });

    const rows = lista
      .map((it) => {
        const nota =
          typeof it.puntuacion === 'number' ? it.puntuacion.toFixed(1) : '';
        return `
        <tr>
          <td>${it.posicion}</td>
          <td>${it.nombreCompleto}</td>
          <td>${it.premio}</td>
          <td>${it.area}</td>
          <td>${it.nivel}</td>
          <td>${nota}</td>
          <td>${it.unidadEducativa}</td>
          <td>${it.departamento}</td>
        </tr>`;
      })
      .join('\n');

    return `
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <thead style="background:#f1f5f9;">
        <tr>
          <th>#</th>
          <th>Nombre completo</th>
          <th>Premio</th>
          <th>Área</th>
          <th>Nivel</th>
          <th>Puntuación</th>
          <th>Unidad educativa</th>
          <th>Departamento</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
  }

  // HU-015:guardar orden sin tocar datos existentes
  async saveReorder(params: {
    id_area: number;
    id_nivel: number;
    orden: Array<{ id_inscripcion: number; posicion: number }>;
    actorId: number;
    nombreVista?: string;
  }) {
    // 2️⃣ NUEVO: Obtener gestión al inicio
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!gestion) throw new BadRequestException('No hay gestión abierta.');

    // validamos que la fase final esta validada
    const st = await this.fases.getStatus(
      params.id_area,
      params.id_nivel,
      PhaseType.FINAL,
    );
    if (st !== 'VALIDADA') {
      throw new HttpException(
        'No es posible guardar el orden: la fase no ha sido avalada.',
        HttpStatus.LOCKED,
      );
    }

    // buscamos/creamos) la lista base para colgar el reordenamiento
    const listaBase = await this.prisma.listas_generadas.findFirst({
      where: {
        tipo_lista: tipo_lista.PREMIADOS,
        id_area: params.id_area,
        id_nivel: params.id_nivel,
      },
      orderBy: { fecha_generacion: 'desc' },
    });

    let id_lista: number;
    if (!listaBase) {
      const nueva = await this.prisma.listas_generadas.create({
        data: {
          tipo_lista: tipo_lista.PREMIADOS,
          id_area: params.id_area,
          id_nivel: params.id_nivel,
          id_gestion: gestion.id_gestion, // <--- ⚠️ AGREGADO
          fuente: fuente_lista.FINAL,
          criterios_orden: { source: 'manual' },
          contenido_snapshot: {},
          generado_por: params.actorId,
        },
      });
      id_lista = nueva.id_lista;
    } else {
      id_lista = listaBase.id_lista;
    }

    // guardamos el reorden
    await this.prisma.reordenamientos.create({
      data: {
        id_lista,
        id_usuario: params.actorId,
        nueva_posicion: params.orden as unknown as Prisma.InputJsonValue,
        fecha_reorden: new Date(),
      },
    });

    return {
      ok: true,
      message: 'Orden guardado correctamente.',
    };
  }

  async getReorderHistory(params: { id_area: number; id_nivel: number }) {
    const listaBase = await this.prisma.listas_generadas.findFirst({
      where: {
        tipo_lista: tipo_lista.PREMIADOS,
        id_area: params.id_area,
        id_nivel: params.id_nivel,
      },
      orderBy: { fecha_generacion: 'desc' },
    });

    if (!listaBase) return [];

    const hist = await this.prisma.reordenamientos.findMany({
      where: { id_lista: listaBase.id_lista },
      orderBy: { fecha_reorden: 'desc' },
      take: 5,
      include: {
        usuario: {
          select: { nombre: true, apellido: true, correo: true },
        },
      },
    });

    return hist.map((h) => ({
      id: h.id_reorden,
      fecha: h.fecha_reorden,
      autor:
        [h.usuario?.nombre, h.usuario?.apellido].filter(Boolean).join(' ') ||
        h.usuario?.correo,
      orden: h.nueva_posicion,
    }));
  }
}
