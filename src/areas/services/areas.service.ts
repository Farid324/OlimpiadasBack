// src/areas/services/areas.service.ts
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

  //rodri
  async getAreasConEstadisticas() {
    console.log('💡 Iniciando consulta a Prisma...');
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
            id_nivel: Number(insc.nivel.id_nivel), // <-- convertir BigInt a number
            nombre_nivel: insc.nivel.nombre_nivel,
            inscritos: 0,
          };
        }
        nivelesMap[nivelIdStr].inscritos += 1;
      });

      return {
        id_area: Number(area.id_area), // <-- convertir BigInt a number
        nombre_area: area.nombre_area,
        estado: area.estado,
        niveles: Object.values(nivelesMap),
      };
    });

    console.log('💡 Datos devueltos por el servicio:', mapped);
    return mapped;
  }
  //Fabia y max
  findAllActive() {
    return this.prisma.areas.findMany({
      where: { activo: true },
      select: { id_area: true, nombre_area: true },
      orderBy: { nombre_area: 'asc' },
    });
  }
}
