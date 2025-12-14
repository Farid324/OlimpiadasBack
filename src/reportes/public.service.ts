// src/reportes/public.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { gestiones } from '@prisma/client';

@Injectable()
export class PublicReportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Reporte público de clasificados.
   * - Por defecto: última gestión CERRADA.
   * - Opcionalmente filtrable por:
   *   - año (anio)
   *   - área (nombre_area)
   *   - nivel (nombre_nivel)
   *   - ci (competidor.ci)
   */
  async getPublicClasificados(params?: {
    anio?: number;
    area?: string;
    nivel?: string;
    ci?: string;
  }) {
    const { anio, area, nivel, ci } = params ?? {};

    // 1) Resolver gestión objetivo
    let gestion: gestiones | null = null;

    if (typeof anio === 'number' && Number.isFinite(anio)) {
      gestion = await this.prisma.gestiones.findFirst({
        where: {
          anio,
          estado: 'CERRADA',
        },
      });
    } else {
      // Última gestión cerrada
      gestion = await this.prisma.gestiones.findFirst({
        where: { estado: 'CERRADA' },
        orderBy: { anio: 'desc' },
      });
    }

    // Si no hay gestión cerrada que cumpla el criterio, devolvemos vacío
    if (!gestion) {
      return [];
    }

    // 2) Construir filtro dinámico sobre inscripciones
    const where: Prisma.inscripcionesWhereInput = {
      id_gestion: gestion.id_gestion,
      clasificacion: 'CLASIFICADO',
      ...(area
        ? {
            area: {
              nombre_area: {
                equals: area.trim(),
                mode: 'insensitive',
              },
            },
          }
        : {}),
      ...(nivel
        ? {
            nivel: {
              nombre_nivel: {
                equals: nivel.trim(),
                mode: 'insensitive',
              },
            },
          }
        : {}),
      ...(ci
        ? {
            competidor: {
              ci: {
                equals: ci.trim(),
                mode: 'insensitive',
              },
            },
          }
        : {}),
    };

    const inscripciones = await this.prisma.inscripciones.findMany({
      where,
      include: {
        competidor: true,
        area: true,
        nivel: true,
      },
      orderBy: [
        // primero mayor puntaje
        { puntaje_clasificacion: 'desc' },
        // a igualdad de puntaje, primero los más antiguos (opcional)
        { created_at: 'asc' },
      ],
    });

    return inscripciones.map((insc) => ({
      id: insc.id_inscripcion,
      name: `${insc.competidor.nombres} ${insc.competidor.apellidos}`.trim(),
      ci: insc.competidor.ci,
      area: insc.area.nombre_area,
      level: insc.nivel.nombre_nivel,
      school: insc.competidor.escuela ?? 'N/A',
      city: insc.competidor.departamento ?? 'N/A',
      score: insc.puntaje_clasificacion
        ? Number(insc.puntaje_clasificacion)
        : 0,
      medal: 'N/A',
      year: gestion.anio,
      status: 'Clasificado',
    }));
  }
}
