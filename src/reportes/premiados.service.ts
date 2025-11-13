// src/reportes/premiados.service.ts
import {
  HttpException,
  HttpStatus,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FasesService } from '../fases/fases.service';
import { PhaseType } from '../fases/dto/close-phase.dto';
import { tipo_lista, fuente_lista } from '@prisma/client';

type EstadoMedalla = 'ORO' | 'PLATA' | 'BRONCE' | 'MENCION';

interface FiltrosPremiados {
  id_area?: number;
  id_nivel?: number;
  estado?: EstadoMedalla;
  actorId?: number;
}

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
  private async buildListForPair(id_area: number, id_nivel: number) {
    const id_fase_final = await this.getFinalPhaseId();

    // 1)medallero del area
    const medallero = await this.prisma.medallero_config.findFirst({
      where: { id_area, id_nivel },
      orderBy: { id_medallero: 'desc' },
    });

    const cfg = {
      oro: medallero?.oros ?? 1,
      plata: medallero?.platas ?? 1,
      bronce: medallero?.bronces ?? 1,
      menciones: medallero?.menciones ?? 0,
    };

    // 2)inscripciones del area/nivel
    const inscripciones = await this.prisma.inscripciones.findMany({
      where: { id_area, id_nivel },
      include: {
        competidor: true,
        area: true,
        nivel: true,
      },
    });

    if (inscripciones.length === 0) return [];

    const ids = inscripciones.map((i) => i.id_inscripcion);

    // 3) sacar promedio de evaluaciones finales firmadas
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

    // 4) ordenar por puntaje descendente y id_inscripcion ascendente
    const ordenados = [...inscripciones]
      .map((insc) => ({
        inscripcion: insc,
        score: scoreMap.get(insc.id_inscripcion) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.inscripcion.id_inscripcion - b.inscripcion.id_inscripcion,
      );

    // 5) asignar medallas
    const salida: Array<{
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
    }> = [];

    let pos = 0;
    for (const item of ordenados) {
      pos += 1;
      const { inscripcion, score } = item;
      const med = this.medallaDePosicion(pos, cfg);
      if (!med.tipo) {
        // fuera de rango de medallero->no se publica
        continue;
      }
      salida.push({
        id_inscripcion: inscripcion.id_inscripcion,
        posicion: pos,
        nombreCompleto:
          `${inscripcion.competidor.nombres} ${inscripcion.competidor.apellidos}`.trim(),
        premio: med.etiqueta ?? '',
        estadoPremio: med.tipo,
        area: inscripcion.area.nombre_area,
        nivel: inscripcion.nivel.nombre_nivel,
        puntuacion: score,
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
        await this.prisma.listas_generadas.create({
          data: {
            tipo_lista: tipo_lista.PREMIADOS,
            id_area: f.id_area,
            id_nivel: f.id_nivel,
            fuente: fuente_lista.FINAL,
            criterios_orden: {},
            contenido_snapshot: filtrados,
            generado_por: f.actorId,
          },
        });
      }

      return filtrados;
    }

    // si no viene area+nivel entonces devolver para todos los pares validados
    const id_fase_final = await this.getFinalPhaseId();
    const cierres = await this.prisma.cierres_fase.findMany({
      where: {
        id_fase: id_fase_final,
        estado_validacion: 'VALIDADO',
      },
      select: { id_area: true, id_nivel: true },
    });

    const all: any[] = [];
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
        nueva_posicion: params.orden,
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
