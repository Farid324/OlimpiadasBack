import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  async getAreasConEstadisticas() {
    // Traemos áreas activas con inscripciones y su nivel
    const areas = await this.prisma.areas.findMany({
      where: { activo: true },
      include: {
        inscripciones: {
          include: { nivel: true }, // para saber el nivel de los inscritos
        },
      },
    });

    return areas.map(area => {
      // Tomamos el nivel de la primera inscripción, si existe
      const primerInscrito = area.inscripciones[0];
      const nivel = primerInscrito
        ? { id_nivel: primerInscrito.nivel.id_nivel, nombre_nivel: primerInscrito.nivel.nombre_nivel }
        : null;

      return {
        id_area: area.id_area,
        nombre_area: area.nombre_area,
        estado: area.estado,
        nivel,
        inscritos: area.inscripciones.length, // cantidad de competidores inscritos
      };
    });
  }
}


