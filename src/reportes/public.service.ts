// src/reportes/public.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicReportService {
  constructor(private prisma: PrismaService) {}

  async getPublicClasificados() {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      select: {
        id_gestion: true,
        anio: true,
      },
    });

    // Si no hay gestión abierta, no exponemos nada
    if (!gestion) {
      return [];
    }

    const inscripciones = await this.prisma.inscripciones.findMany({
      where: {
        clasificacion: 'CLASIFICADO',
        id_gestion: gestion.id_gestion,
      },
      include: {
        competidor: true,
        area: true,
        nivel: true,
      },
      orderBy: [{ puntaje_clasificacion: 'desc' }, { created_at: 'desc' }],
    });

    return inscripciones.map((insc) => ({
      id: insc.id_inscripcion,
      name: `${insc.competidor.nombres} ${insc.competidor.apellidos}`,
      ci: insc.competidor.ci,
      area: insc.area.nombre_area,
      level: insc.nivel.nombre_nivel,
      school: insc.competidor.escuela ?? 'N/A',
      city: insc.competidor.departamento ?? 'N/A',
      score: insc.puntaje_clasificacion
        ? Number(insc.puntaje_clasificacion)
        : 0,
      medal: 'N/A',
      year: gestion.anio || new Date(insc.created_at).getFullYear(),
      status: 'Clasificado',
    }));
  }
}
