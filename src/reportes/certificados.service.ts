// src/reportes/certificados.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { PremiadosService } from './premiados.service';

type TipoPremio = 'ORO' | 'PLATA' | 'BRONCE' | 'MENCION';
type ExportFiltros = { id_area?: number; id_nivel?: number; anio?: number };
type PremiadoRowLite = {
  id_inscripcion: number;
  posicion: number | null;
  nombreCompleto: string;
  premio: string;
  estadoPremio: 'ORO' | 'PLATA' | 'BRONCE' | 'MENCION';
  area: string;
  nivel: string;
  puntuacion: number;
  unidadEducativa: string;
  departamento: string;
};

const TIPO_ORDER: Record<TipoPremio, number> = {
  ORO: 1,
  PLATA: 2,
  BRONCE: 3,
  MENCION: 4,
};

@Injectable()
export class CertificadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly premiadosService: PremiadosService,
  ) {}

  /* ======================================================
     1) PREMIADOS → EXCEL
     ====================================================== */
  async exportarExcelPremiados(f: ExportFiltros): Promise<Buffer> {
    const anio = f.anio ?? new Date().getFullYear();

    // 1) Obtener la misma lista que ve el usuario en el tab de "Premiados"
    const lista = (await this.premiadosService.list({
      id_area: f.id_area,
      id_nivel: f.id_nivel,
      // sin filtro de estado: traemos todos los premiados (oro, plata, bronce, mención)
      estado: undefined,
      actorId: undefined,
    })) as PremiadoRowLite[];

    if (!lista.length) {
      throw new BadRequestException('No hay premiados para exportar.');
    }

    // 2) Obtener CI y otros datos adicionales desde inscripciones/competidor
    const inscIds = lista.map((p) => p.id_inscripcion);

    const inscripciones = await this.prisma.inscripciones.findMany({
      where: { id_inscripcion: { in: inscIds } },
      include: {
        competidor: true,
        area: true,
        nivel: true,
      },
    });

    // índice para buscar rápido
    const inscMap = new Map<number, (typeof inscripciones)[number]>();
    for (const insc of inscripciones) {
      inscMap.set(insc.id_inscripcion, insc);
    }

    // 3) Armar filas combinando la info de la lista + CI + año
    const rows = lista
      .map((p) => {
        const insc = inscMap.get(p.id_inscripcion);
        if (!insc) return null;

        return {
          id_inscripcion: p.id_inscripcion,
          nombreCompleto: p.nombreCompleto,
          ci: insc.competidor.ci ?? '',
          area: p.area,
          nivel: p.nivel,
          tipoPremio: p.estadoPremio as TipoPremio,
          unidadEducativa: p.unidadEducativa || insc.competidor.escuela || '',
          departamento: p.departamento || insc.competidor.departamento || '',
          anio,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => {
        const t1 = TIPO_ORDER[a.tipoPremio];
        const t2 = TIPO_ORDER[b.tipoPremio];
        if (t1 !== t2) return t1 - t2;
        if (a.area !== b.area) return a.area.localeCompare(b.area, 'es');
        if (a.nivel !== b.nivel) return a.nivel.localeCompare(b.nivel, 'es');
        return a.nombreCompleto.localeCompare(b.nombreCompleto, 'es');
      });

    if (!rows.length) {
      throw new BadRequestException('No hay premiados para exportar.');
    }

    // 4) Generar el Excel
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Premiados');

    const now = new Date();
    const fecha = now.toLocaleDateString('es-BO');

    const titulo = 'Sistema de Registro y Evaluaciones Oh SanSi – Premiados';
    const subtitulo = `LISTA DE GANADORES Y MENCIONES – ${fecha}`;

    const headers = [
      'N°',
      'CI',
      'Nombre completo',
      'Área',
      'Nivel',
      'Tipo de premio',
      'Unidad Educativa',
      'Departamento',
      'Año',
    ];

    ws.addRow([titulo]);
    ws.mergeCells('A1:I1');
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.addRow([subtitulo]);
    ws.mergeCells('A2:I2');
    ws.getCell('A2').font = { bold: true, size: 12 };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    ws.addRow([]);

    const startRow = ws.lastRow!.number + 1;

    ws.addTable({
      name: 'TablaPremiados',
      ref: `A${startRow}`,
      headerRow: true,
      style: {
        theme: 'TableStyleMedium9',
        showRowStripes: true,
      },
      columns: headers.map((name) => ({ name, filterButton: true })),
      rows: rows.map((r, idx) => [
        idx + 1,
        r.ci,
        r.nombreCompleto,
        r.area,
        r.nivel,
        r.tipoPremio,
        r.unidadEducativa,
        r.departamento,
        r.anio,
      ]),
    });

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 32;
    ws.getColumn(4).width = 16;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 18;
    ws.getColumn(7).width = 26;
    ws.getColumn(8).width = 16;
    ws.getColumn(9).width = 10;

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
  }

  /* ======================================================
     2) PARTICIPACIÓN → EXCEL
     ====================================================== */
  async exportarExcelParticipacion(f: ExportFiltros): Promise<Buffer> {
    const anio = f.anio ?? new Date().getFullYear();

    // 1. todos los clasificados del área/nivel
    const clasificados = await this.prisma.inscripciones.findMany({
      where: {
        ...(f.id_area ? { id_area: f.id_area } : {}),
        ...(f.id_nivel ? { id_nivel: f.id_nivel } : {}),
        clasificacion: 'CLASIFICADO',
      },
      include: {
        competidor: true,
        area: true,
        nivel: true,
      },
      orderBy: [
        { id_area: 'asc' },
        { id_nivel: 'asc' },
        { puntaje_clasificacion: 'desc' },
      ],
    });

    if (!clasificados.length) {
      throw new BadRequestException(
        'No hay clasificados para exportar certificados de participación.',
      );
    }

    // 2. premiados para excluirlos
    let premiadosIds: number[] = [];

    if (f.id_area && f.id_nivel) {
      // Para un área+nivel concreto, asegúrate de que los premios existen
      const premios = await this.ensurePremiosGenerados({
        id_area: f.id_area,
        id_nivel: f.id_nivel,
        anio,
      });
      premiadosIds = premios.map((p) => p.id_inscripcion);
    } else {
      // usa lo que ya esté en premios_otorgados
      const premios = await this.prisma.premios_otorgados.findMany({
        where: { anio },
        select: { id_inscripcion: true },
      });
      premiadosIds = premios.map((p) => p.id_inscripcion);
    }

    const premiadosSet = new Set(premiadosIds);

    const participantes = clasificados.filter(
      (c) => !premiadosSet.has(c.id_inscripcion),
    );

    if (!participantes.length) {
      throw new BadRequestException(
        'No hay clasificados sin premio para exportar certificados de participación.',
      );
    }

    // 3. armar excel
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Participación');

    const now = new Date();
    const fecha = now.toLocaleDateString('es-BO');

    const titulo =
      'Sistema de Registro y Evaluaciones Oh SanSi – Participación';
    const subtitulo = `LISTA DE CLASIFICADOS SIN PREMIO – ${fecha}`;

    const headers = [
      'N°',
      'CI',
      'Nombre completo',
      'Área',
      'Nivel',
      'Tipo de certificado',
      'Unidad Educativa',
      'Departamento',
      'Año',
    ];

    ws.addRow([titulo]);
    ws.mergeCells('A1:I1');
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.addRow([subtitulo]);
    ws.mergeCells('A2:I2');
    ws.getCell('A2').font = { bold: true, size: 12 };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    ws.addRow([]);

    const startRow = ws.lastRow!.number + 1;

    ws.addTable({
      name: 'TablaParticipacion',
      ref: `A${startRow}`,
      headerRow: true,
      style: {
        theme: 'TableStyleMedium9',
        showRowStripes: true,
      },
      columns: headers.map((name) => ({ name, filterButton: true })),
      rows: participantes.map((c, idx) => [
        idx + 1,
        c.competidor.ci ?? '',
        `${c.competidor.nombres} ${c.competidor.apellidos}`.trim(),
        c.area.nombre_area,
        c.nivel.nombre_nivel,
        'Participación',
        c.competidor.escuela ?? '',
        c.competidor.departamento ?? '',
        anio,
      ]),
    });

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 32;
    ws.getColumn(4).width = 16;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 20;
    ws.getColumn(7).width = 26;
    ws.getColumn(8).width = 16;
    ws.getColumn(9).width = 10;

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
  }

  /* ======================================================
     helper: asegurar premios_otorgados usando medallero_config
     ====================================================== */
  private async ensurePremiosGenerados({
    id_area,
    id_nivel,
    anio,
  }: {
    id_area?: number;
    id_nivel?: number;
    anio: number;
  }) {
    const existentes = await this.prisma.premios_otorgados.findMany({
      where: {
        anio,
        ...(id_area ? { id_area } : {}),
        ...(id_nivel ? { id_nivel } : {}),
      },
    });
    if (existentes.length) return existentes;

    if (!id_area || !id_nivel) return [];

    // 1️⃣ NUEVO: Obtener gestión abierta
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!gestion) return []; // Si no hay gestión, no podemos generar

    // Medallero por area+nivel
    const medallero = await this.prisma.medallero_config.findFirst({
      where: {
        id_area,
        id_nivel,
        id_gestion: gestion.id_gestion, 
      },
      orderBy: { id_medallero: 'desc' },
    });

    const cfg = {
      oros: medallero?.oros ?? 1,
      platas: medallero?.platas ?? 1,
      bronces: medallero?.bronces ?? 1,
      menciones: medallero?.menciones ?? 0,
    };

    // === FINAL: obtener promedios de evaluaciones FINALES FIRMADAS ===
    const faseFinal = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'FINAL' },
      select: { id_fase: true },
    });
    if (!faseFinal) return [];

    // inscripciones del par area+nivel
    const inscs = await this.prisma.inscripciones.findMany({
      where: { id_area, id_nivel },
      select: { id_inscripcion: true },
    });
    if (!inscs.length) return [];
    const ids = inscs.map((i) => i.id_inscripcion);

    const evals = await this.prisma.evaluaciones.groupBy({
      by: ['id_inscripcion'],
      where: {
        id_inscripcion: { in: ids },
        id_fase: faseFinal.id_fase,
        estado_registro: 'FIRMADA',
      },
      _avg: { nota: true },
    });

    // ordenar por score desc y desempatar por id asc
    const ordenados = evals
      .map((e) => ({
        id_inscripcion: e.id_inscripcion,
        score: Number(e._avg.nota ?? 0),
      }))
      .sort((a, b) => b.score - a.score || a.id_inscripcion - b.id_inscripcion);

    // 2️⃣ CORRECCIÓN: Agregar id_gestion al tipo del array
    const toCreate: Array<{
      id_inscripcion: number;
      id_area: number;
      id_nivel: number;
      anio: number;
      id_gestion: number; // <--- CAMPO OBLIGATORIO
      tipo: TipoPremio;
    }> = [];

    let pos = 1;
    for (const e of ordenados) {
      const tipo = this.tipoPorPosicion(pos, cfg);
      if (!tipo) break;
      toCreate.push({
        id_inscripcion: e.id_inscripcion,
        id_area,
        id_nivel,
        anio,
        id_gestion: gestion.id_gestion, // <--- INYECTAMOS LA GESTIÓN
        tipo,
      });
      pos++;
    }

    if (!toCreate.length) return [];

    const creados = await this.prisma.$transaction(
      toCreate.map((d) => this.prisma.premios_otorgados.create({ data: d })),
    );

    return creados;
  }

  private tipoPorPosicion(
    pos: number,
    cfg: { oros: number; platas: number; bronces: number; menciones: number },
  ): TipoPremio | null {
    if (pos <= cfg.oros) return 'ORO';
    if (pos <= cfg.oros + cfg.platas) return 'PLATA';
    if (pos <= cfg.oros + cfg.platas + cfg.bronces) return 'BRONCE';
    if (pos <= cfg.oros + cfg.platas + cfg.bronces + cfg.menciones)
      return 'MENCION';
    return null;
  }
}
