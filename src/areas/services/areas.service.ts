import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto } from '../dto/create-area.dto';

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  // jaumpi y vivi
  findAll() {
    return this.prisma.areas.findMany({
      where: { activo: true },
      orderBy: { nombre_area: 'asc' },
    });
  }

  // far
  async create(data: CreateAreaDto) {
    return this.prisma.areas.create({
      data: {
        nombre_area: data.nombre_area,
        nota_aprobacion: data.nota_aprobacion,
        tipo: data.tipo,
        niveles_target: data.niveles_target,
        activo: true,
      },
    });
  }

  async update(id: number, data: CreateAreaDto) {
    return this.prisma.areas.update({
      where: { id_area: id },
      data: {
        nombre_area: data.nombre_area,
        nota_aprobacion: data.nota_aprobacion,
        tipo: data.tipo,
        niveles_target: data.niveles_target,
      },
    });
  }

  async remove(id: number) {
    // Soft delete (solo desactivar)
    return this.prisma.areas.update({
      where: { id_area: id },
      data: { activo: false },
    });
  }

  /* ============================================================
   * 1) Estadísticas GENERALES (formato agrupado por área)
   *    -> Usar en las demás pestañas
   * ============================================================ */
  async getAreasConEstadisticas() {
    console.log('💡 Iniciando consulta a Prisma (general)...');

    const areas = await this.prisma.areas.findMany({
      where: { activo: true },
      include: {
        inscripciones: {
          include: { nivel: true },
        },
      },
    });

    console.log('💡 Consulta realizada, areas:', areas.length);

    const mapped = areas.map((area) => {
      const nivelesMap: Record<
        string,
        { id_nivel: number; nombre_nivel: string; inscritos: number }
      > = {};

      area.inscripciones.forEach((insc) => {
        if (!insc.nivel) return;
        const nivelIdStr = insc.nivel.id_nivel.toString();
        if (!nivelesMap[nivelIdStr]) {
          nivelesMap[nivelIdStr] = {
            id_nivel: Number(insc.nivel.id_nivel), // BigInt -> number
            nombre_nivel: insc.nivel.nombre_nivel,
            inscritos: 0,
          };
        }
        nivelesMap[nivelIdStr].inscritos += 1;
      });

      return {
        id_area: Number(area.id_area), // BigInt -> number
        nombre_area: area.nombre_area,
        estado: area.estado,
        niveles: Object.values(nivelesMap),
      };
    });

    console.log('💡 Datos devueltos por el servicio (general):', mapped.length);
    return mapped;
  }

  /* =================================================================
   * 2) Estadísticas para PANEL PRINCIPAL
   *    - Una tarjeta por combinación (Área + Nivel)
   *    - Sólo niveles de Primaria y Secundaria
   * ================================================================= */
  async getAreasConEstadisticasPanelPrincipal() {
    console.log('💡 Iniciando consulta a Prisma (panel principal)...');

    // Niveles que quieres mostrar en el panel principal
    const NIVELES_PERMITIDOS = ['PRIMARIA', 'SECUNDARIA'];

    const areas = await this.prisma.areas.findMany({
      where: { activo: true },
      include: {
        inscripciones: {
          select: {
            id_inscripcion: true,
            nivel: {
              select: {
                id_nivel: true,
                nombre_nivel: true,
              },
            },
          },
        },
      },
      orderBy: { nombre_area: 'asc' },
    });

    console.log('💡 Consulta realizada, áreas base (panel):', areas.length);

    const combinaciones: {
      id_area: number;
      nombre_area: string;
      estado: string;
      id_nivel: number;
      nombre_nivel: string;
      total_inscritos: number;
    }[] = [];

    areas.forEach((area) => {
      const nivelesMap = new Map<number, number>(); // Map<id_nivel, count>
      const nivelDetails = new Map<number, { id: number; nombre: string }>(); // detalles nivel

      area.inscripciones.forEach((inscripcion) => {
        if (!inscripcion.nivel) return;

        const idNivel = Number(inscripcion.nivel.id_nivel);
        const nombreNivel = inscripcion.nivel.nombre_nivel?.toUpperCase() ?? '';

        // Filtrar sólo niveles permitidos (Primaria / Secundaria)
        const esNivelPermitido = NIVELES_PERMITIDOS.some((niv) =>
          nombreNivel.includes(niv),
        );
        if (!esNivelPermitido) return;

        // 1. Contar inscritos por nivel
        nivelesMap.set(idNivel, (nivelesMap.get(idNivel) || 0) + 1);

        // 2. Guardar detalles del nivel
        if (!nivelDetails.has(idNivel)) {
          nivelDetails.set(idNivel, {
            id: idNivel,
            nombre: inscripcion.nivel.nombre_nivel,
          });
        }
      });

      // Generar una entrada por combinación (Área + Nivel permitido)
      nivelesMap.forEach((count, id_nivel) => {
        const details = nivelDetails.get(id_nivel);
        if (!details) return;

        combinaciones.push({
          id_area: Number(area.id_area),
          nombre_area: area.nombre_area,
          estado: area.estado,
          id_nivel: details.id,
          nombre_nivel: details.nombre,
          total_inscritos: count,
        });
      });
    });

    // Ordenar por área y luego por nivel
    combinaciones.sort((a, b) => {
      if (a.nombre_area < b.nombre_area) return -1;
      if (a.nombre_area > b.nombre_area) return 1;
      return a.nombre_nivel.localeCompare(b.nombre_nivel);
    });

    console.log(
      '💡 Datos devueltos por el servicio (panel principal, combinaciones A/N):',
      combinaciones.length,
    );
    return combinaciones;
  }

  // Fabia y max
  findAllActive() {
    return this.prisma.areas.findMany({
      where: { activo: true },
      select: { id_area: true, nombre_area: true },
      orderBy: { nombre_area: 'asc' },
    });
  }
}
