import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompetidorListadoDto, MedalleroResumenDto } from './dto';
import { tipo_premio, estado_inscripcion } from '@prisma/client';

// Tipos de inclusión para Prisma (para no repetir código)
const inscripcionInclude = {
  competidor: {
    select: { nombres: true, apellidos: true, ci: true, escuela: true, departamento: true },
  },
  area: { select: { nombre_area: true } },
  gestion: { select: { anio: true, id_gestion: true } },
  premios: { 
    select: { tipo: true, fuente: true },
  }
};

@Injectable()
export class PrincipalService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene la gestión ABIERTA (actual) por su ID.
   * @returns El id_gestion activo.
   */
  async obtenerGestionActiva(): Promise<{ id_gestion: number, anio: number }> {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      select: { id_gestion: true, anio: true },
    });
    if (!gestion) {
        // Podrías manejar esto con una excepción o devolver null/default según tu flujo
        throw new NotFoundException('No hay ninguna gestión ABIERTA actualmente.');
    }
    return gestion;
  }

  /**
   * Transforma un objeto inscripcion en el DTO de listado de competidor.
   * Se requiere que la consulta use 'include: inscripcionInclude'.
   */
  private mapInscripcionToDto(
    inscripcion: any, // Usar 'any' para manejar las relaciones cargadas
    faseActual: 'CLASIFICATORIA' | 'FINAL',
    isHistorico: boolean = false,
  ): CompetidorListadoDto {
    const puntajeClasificacion = inscripcion.puntaje_clasificacion?.toNumber() ?? null;
    const puntajeFinal = inscripcion.puntaje_final?.toNumber() ?? null;
    
    let puntaje: number | null = null;
    let medalla: CompetidorListadoDto['medalla'] = null;
    let faseLlegada: CompetidorListadoDto['faseLlegada'] = 'CLASIFICATORIA';

    if (faseActual === 'CLASIFICATORIA') {
        puntaje = puntajeClasificacion;
    } else { // Fase Final o Histórico
        puntaje = puntajeFinal ?? puntajeClasificacion; // Usar final, si no existe usar clasificatorio
        
        // Determinar fase de llegada para Histórico
        if (isHistorico) {
            if (inscripcion.estado_inscripcion === 'FINALISTA' || inscripcion.estado_inscripcion === 'PREMIADO' || puntajeFinal !== null) {
                faseLlegada = 'FINAL';
            }
        }
        
        // Buscar medalla (siempre de la fase FINAL para el resumen/histórico)
        const premio = inscripcion.premios.find(p => p.tipo && p.fuente === 'FINAL');
        medalla = premio?.tipo ?? null;
    }

    // Si es histórico, busca cualquier premio si no encontró uno 'FINAL'
    if (isHistorico && !medalla) {
        const anyPremio = inscripcion.premios.find(p => p.tipo);
        medalla = anyPremio?.tipo ?? null;
    }
    
    const dto: CompetidorListadoDto = {
      idInscripcion: inscripcion.id_inscripcion,
      nombre: `${inscripcion.competidor.nombres} ${inscripcion.competidor.apellidos}`,
      ci: inscripcion.competidor.ci,
      area: inscripcion.area.nombre_area,
      colegio: inscripcion.competidor.escuela ?? null,
      ciudad: inscripcion.competidor.departamento ?? null,
      anio: inscripcion.gestion.anio,
      puntaje: puntaje,
      medalla: medalla,
      estadoInscripcion: inscripcion.estado_inscripcion as CompetidorListadoDto['estadoInscripcion'],
    };

    if (isHistorico) {
        dto.faseLlegada = faseLlegada;
    }

    return dto;
  }


  // --- Lógica para Pestaña "Clasificados 2025" ---

  /**
   * Obtiene los datos para las tarjetas de resumen (Cards).
   */
  async getResumenMedallero(): Promise<MedalleroResumenDto> {
    const gestionActiva = await this.obtenerGestionActiva();
    const idGestion = gestionActiva.id_gestion;

    const [clasificandoCount, medallas] = await Promise.all([
      // 1. Conteo de 'Clasificando' (Clasificados a Fase Final, que son los que están en estado 'CLASIFICADO', 'FINALISTA', o 'PREMIADO')
      this.prisma.inscripciones.count({
        where: {
          id_gestion: idGestion,
          estado_inscripcion: {
            in: ['CLASIFICADO', 'FINALISTA', 'PREMIADO'],
          },
        },
      }),

      // 2. Conteo de Medallas (Solo de la fase final para el resumen actual)
      this.prisma.premios_otorgados.groupBy({
        by: ['tipo'],
        where: {
          id_gestion: idGestion,
          fuente: 'FINAL',
        },
        _count: {
          tipo: true,
        },
      }),
    ]);

    const resumen: MedalleroResumenDto = {
      clasificando: clasificandoCount,
      medallasOro: medallas.find(m => m.tipo === 'ORO')?._count.tipo ?? 0,
      medallasPlata: medallas.find(m => m.tipo === 'PLATA')?._count.tipo ?? 0,
      medallasBronce: medallas.find(m => m.tipo === 'BRONCE')?._count.tipo ?? 0,
    };

    return resumen;
  }


  /**
   * Obtiene la lista de competidores para la FASE CLASIFICATORIA de la gestión actual.
   */
  async getCompetidoresClasificatoria(
    idArea?: number,
    medallaTipo?: tipo_premio | null,
  ): Promise<CompetidorListadoDto[]> {
    const gestionActiva = await this.obtenerGestionActiva();
    const idGestion = gestionActiva.id_gestion;

    const inscripciones = await this.prisma.inscripciones.findMany({
      where: {
        id_gestion: idGestion,
        ...(idArea && { id_area: idArea }),
        // NOTA: El filtro de medalla se ignora aquí, ya que el puntaje es preliminar.
      },
      orderBy: {
        puntaje_clasificacion: 'desc',
      },
      include: inscripcionInclude,
    });

    return inscripciones.map(i => this.mapInscripcionToDto(i, 'CLASIFICATORIA'));
  }


  /**
   * Obtiene la lista de competidores para la FASE FINAL de la gestión actual.
   * Solo incluye competidores que pasaron la clasificatoria.
   */
  async getCompetidoresFaseFinal(
    idArea?: number,
    medallaTipo?: tipo_premio | null,
  ): Promise<CompetidorListadoDto[]> {
    const gestionActiva = await this.obtenerGestionActiva();
    const idGestion = gestionActiva.id_gestion;

    const whereCondition = {
      id_gestion: idGestion,
      estado_inscripcion: {
        in: ['CLASIFICADO', 'FINALISTA', 'PREMIADO'],
      },
      ...(idArea && { id_area: idArea }),
    };

    const inscripciones = await this.prisma.inscripciones.findMany({
      where: {
        ...whereCondition,
        // Filtro de medalla: busca un premio en la tabla premios_otorgados de la fase final
        ...(medallaTipo && {
          premios: {
            some: {
              tipo: medallaTipo,
              fuente: 'FINAL',
              id_gestion: idGestion,
            },
          },
        }),
      },
      orderBy: {
        puntaje_final: 'desc',
      },
      include: inscripcionInclude,
    });

    return inscripciones.map(i => this.mapInscripcionToDto(i, 'FINAL'));
  }


  // --- Lógica para Pestaña "Histórico" ---

  /**
   * Obtiene los años de las gestiones CERRADAS para el filtro de Histórico.
   */
  async getAniosHistorico(): Promise<{ anio: number }[]> {
    // Usamos distinct para solo obtener un año, incluso si hay múltiples gestiones con el mismo 'anio'
    return this.prisma.gestiones.findMany({
      where: { estado: 'CERRADA' },
      distinct: ['anio'],
      select: { anio: true },
      orderBy: { anio: 'desc' },
    });
  }

  /**
   * Obtiene la lista de competidores para la pestaña de Histórico.
   */
  async getCompetidoresHistorico(
    anio: number,
    idArea?: number,
    medallaTipo?: tipo_premio | null,
  ): Promise<CompetidorListadoDto[]> {
    
    // Obtener todas las gestiones CERRADAS para el año.
    const gestiones = await this.prisma.gestiones.findMany({
        where: { anio: anio, estado: 'CERRADA' },
        select: { id_gestion: true }
    });

    if (gestiones.length === 0) return [];
    
    const idGestiones = gestiones.map(g => g.id_gestion);
    
    // Condición de filtro
    const whereCondition = {
        id_gestion: { in: idGestiones },
        ...(idArea && { id_area: idArea }),
    };

    // Consulta con el filtro de medalla aplicado
    const inscripciones = await this.prisma.inscripciones.findMany({
        where: {
            ...whereCondition,
            ...(medallaTipo && {
                premios: {
                    some: {
                        tipo: medallaTipo,
                        id_gestion: { in: idGestiones },
                    },
                },
            }),
        },
        orderBy: [
            { puntaje_final: 'desc' }, // Preferencia de orden por puntaje final
            { puntaje_clasificacion: 'desc' }, // Sino por clasificatorio
        ],
        include: inscripcionInclude,
    });

    // Mapeo para histórico
    return inscripciones.map(i => this.mapInscripcionToDto(i, 'FINAL', true));
  }
}