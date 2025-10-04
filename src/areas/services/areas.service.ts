import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  async getAreasConEstadisticas() {
    const areas = await this.prisma.areas.findMany({
      where: { activo: true },
      include: {
        inscripciones: {
          include: { nivel: true },
        },
        niveles: true, // opcional si quieres traer todos los niveles
      },
    });

    // Mapear para tener la estructura del DTO
    return areas.map(area => {
      const nivelesMap: Record<number, { id_nivel: number; nombre_nivel: string; inscritos: number }> = {};

      area.inscripciones.forEach(insc => {
        const nivelId = insc.nivel.id_nivel;
        if (!nivelesMap[nivelId]) {
          nivelesMap[nivelId] = {
            id_nivel: nivelId,
            nombre_nivel: insc.nivel.nombre_nivel,
            inscritos: 0,
          };
        }
        nivelesMap[nivelId].inscritos += 1;
      });

      return {
        id_area: area.id_area,
        nombre_area: area.nombre_area,
        estado: area.estado,
        niveles: Object.values(nivelesMap),
      };
    });
  }
}
