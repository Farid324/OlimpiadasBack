// src/reportes/public.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicReportService {
  constructor(private prisma: PrismaService) {}

  async getPublicClasificados() {
    const inscripciones = await this.prisma.inscripciones.findMany({
      where: {
        clasificacion: 'CLASIFICADO',
      },
      include: {
        competidor: true, // Ya incluye el CI
        area: true,
        nivel: true,
      },
      orderBy: [{ created_at: 'desc' }, { puntaje_clasificacion: 'desc' }],
    });

    return inscripciones.map((insc) => ({
      id: insc.id_inscripcion,
      name: `${insc.competidor.nombres} ${insc.competidor.apellidos}`,
      ci: insc.competidor.ci, // 👈 AÑADIR CI
      area: insc.area.nombre_area,
      level: insc.nivel.nombre_nivel,
      school: insc.competidor.escuela ?? 'N/A',
      city: insc.competidor.departamento ?? 'N/A',
      score: insc.puntaje_clasificacion
        ? Number(insc.puntaje_clasificacion)
        : 0,
      medal: 'N/A',
      year: new Date(insc.created_at).getFullYear(),
      status: 'Clasificado',
    }));
  }
}
