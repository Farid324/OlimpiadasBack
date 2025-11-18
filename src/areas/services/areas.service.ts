import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  
  //rodri - MODIFICADO para devolver por Área y Nivel con conteo correcto
  async getAreasConEstadisticas() {
    console.log('💡 Iniciando consulta a Prisma...');
    
    // 1. Obtener todas las áreas activas con sus inscripciones y niveles
    const areas = await this.prisma.areas.findMany({
      where: { activo: true },
      include: {
        inscripciones: {
          // Solo necesitamos seleccionar los campos para contar y obtener el detalle del nivel
          select: { 
              id_inscripcion: true, 
              nivel: { select: { id_nivel: true, nombre_nivel: true } }
          },
        },
      },
      orderBy: { nombre_area: 'asc' },
    });
    
    console.log('💡 Consulta realizada, áreas base:', areas.length);

    // 2. Mapeo para agrupar las inscripciones por (Área, Nivel)
    const combinaciones: {
      id_area: number;
      nombre_area: string;
      estado: string;
      id_nivel: number;
      nombre_nivel: string;
      total_inscritos: number;
    }[] = [];
    
    areas.forEach(area => {
        const nivelesMap = new Map<number, number>(); // Map<id_nivel, count>
        const nivelDetails = new Map<number, {id: number, nombre: string}>(); // Map<id_nivel, details>
        
        area.inscripciones.forEach(inscripcion => {
            if (inscripcion.nivel) {
                // Convertir BigInt a number
                const idNivel = Number(inscripcion.nivel.id_nivel); 
                
                // 1. Contar los inscritos por nivel
                nivelesMap.set(idNivel, (nivelesMap.get(idNivel) || 0) + 1);
                
                // 2. Guardar los detalles del nivel (nombre)
                if (!nivelDetails.has(idNivel)) {
                    nivelDetails.set(idNivel, {
                        id: idNivel,
                        nombre: inscripcion.nivel.nombre_nivel
                    });
                }
            }
        });
        
        // 3. Generar una entrada (tarjeta) para cada combinación (Área + Nivel)
        nivelesMap.forEach((count, id_nivel) => {
            const details = nivelDetails.get(id_nivel);

            // Solo agregamos la combinación si el nivel existe (para evitar undefined)
            if (details) {
                 combinaciones.push({
                    id_area: Number(area.id_area),
                    nombre_area: area.nombre_area,
                    estado: area.estado,
                    id_nivel: details.id,
                    nombre_nivel: details.nombre,
                    total_inscritos: count, 
                });
            }
        });
        
        // Si el área no tiene inscripciones, se puede decidir si se muestra.
        // Por simplicidad, si no hay inscripciones, no se genera una tarjeta.
    });

    // Ordenar por Nombre de Área y luego por Nombre de Nivel
    combinaciones.sort((a, b) => {
      if (a.nombre_area < b.nombre_area) return -1;
      if (a.nombre_area > b.nombre_area) return 1;
      return a.nombre_nivel.localeCompare(b.nombre_nivel);
    });

    console.log('💡 Datos devueltos por el servicio (combinaciones A/N):', combinaciones.length);
    return combinaciones;
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