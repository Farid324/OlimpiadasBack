//src/reportes/publicacion/publicacion.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryPublicacionDto } from './dto/query-publicacion.dto';
import { PublicacionRow } from './excel/publicacion.excel'; // Importa el tipo

// Helper para ordenar por nombre
const cmpStr = (a: string, b: string) =>
  a.localeCompare(b, 'es', { sensitivity: 'base' });

@Injectable()
export class PublicacionService {
  constructor(private readonly prisma: PrismaService) {}

  async findRows(query: QueryPublicacionDto): Promise<PublicacionRow[]> {
    // 1. El DTO nos da 'anio' (opcional)
    const year = query.anio;

    const inscripciones = await this.prisma.inscripciones.findMany({
      where: {
        // Filtros de tu pestaña
        ...(query.id_area ? { id_area: query.id_area } : {}),
        ...(query.id_nivel ? { id_nivel: query.id_nivel } : {}),

        // 2. ¡AQUÍ ESTÁ EL TRUCO!
        // Filtramos por el 'anio' en la tabla RELACIONADA 'premios'
        ...(year
          ? {
              premios: {
                // 'some' significa: "al menos un premio de esta inscripción cumple la condición"
                some: { anio: year },
              },
            }
          : {}),
      },
      include: {
        competidor: true,
        area: true,
        nivel: true,
        premios: true, // ¡Fundamental para obtener el año y la medalla!
      },
    });

    // 3. Mapea los datos de Prisma a las filas del Excel
    let rows = inscripciones.map((i) => {
      // Asumimos que el primer premio tiene la info que necesitamos
      const premioPrincipal = i.premios.length > 0 ? i.premios[0] : null;

      return {
        name: `${i.competidor?.nombres ?? ''} ${
          i.competidor?.apellidos ?? ''
        }`.trim(),
        ci: i.competidor?.ci ?? '',
        area: i.area?.nombre_area ?? '',
        school: i.competidor?.escuela ?? '',
        city: i.competidor?.departamento ?? '',
        // 4. ¡AHORA SÍ FUNCIONA! Obtenemos el año y la medalla desde el premio
        year: premioPrincipal?.anio ?? 0, // Si no tiene premio, pondrá 0 (o ajusta a tu gusto)
        score: i.puntaje_clasificacion?.toNumber() ?? 0,
        medal: premioPrincipal?.tipo ?? 'N/A',
      };
    });

    // 5. (Paso extra de seguridad)
    // Si el usuario filtró por un año, nos aseguramos de que solo se muestren
    // inscripciones que *realmente* tengan ese año (por si el mapeo falla)
    if (year) {
      rows = rows.filter((r) => r.year === year);
    }

    // 6. Ordena por nombre
    rows.sort((a, b) => cmpStr(a.name || '', b.name || ''));

    return rows;
  }
}
