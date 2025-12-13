// src/principal/principal.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompetidorListadoDto, MedalleroResumenDto } from './dto';
import {
  tipo_premio,
  estado_inscripcion,
  fuente_lista,
  gestiones,
  estado_validacion,
  Prisma
} from '@prisma/client';

// Tipo corregido para que coincida EXACTAMENTE con el include usado
type InscripcionIncluida = Prisma.inscripcionesGetPayload<{
  include: {
    competidor: true;
    area: true;
    gestion: true;
    premios: true;
  };
}>;

@Injectable()
export class PrincipalService {
  constructor(private prisma: PrismaService) {}

  // --- Obtener gestión activa (ABIERTA)
  async obtenerGestionActiva(): Promise<{ id_gestion: number; anio: number }> {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' as gestiones['estado'] },
      select: { id_gestion: true, anio: true },
      orderBy: { id_gestion: 'desc' },
    });
    return gestion ?? { id_gestion: 0, anio: new Date().getFullYear() };
  }

  // --- Obtener ids áreas cerradas (Se mantiene para Clasificatoria e Histórico)
  private async getIdsAreasCerradas(idGestion: number, idFase: number): Promise<number[]> {
    if (!idGestion) return [];
    const cierresValidados = await this.prisma.cierres_fase.findMany({
      where: {
        id_gestion: idGestion,
        id_fase: idFase,
        estado_validacion: 'VALIDADO' as estado_validacion,
      },
      select: { id_area: true },
      distinct: ['id_area'],
    });
    return cierresValidados.map(c => c.id_area);
  }

  // --- Mapper simplificado: ya no se usa faseLlegada ---
  private mapInscripcionToDto(
    inscripcion: InscripcionIncluida,
    faseActual: 'CLASIFICATORIA' | 'FINAL'
  ): CompetidorListadoDto {
    // === CORRECCIÓN APLICADA AQUÍ: Se fuerza la conversión a string antes de Number ===
    const puntajeClasificacion = inscripcion.puntaje_clasificacion 
      ? Number(inscripcion.puntaje_clasificacion.toString()) 
      : null;
      
    const puntajeFinal = inscripcion.puntaje_final 
      ? Number(inscripcion.puntaje_final.toString()) 
      : null;
    // =================================================================================

    let puntaje: number | null = faseActual === 'CLASIFICATORIA' 
                                 ? puntajeClasificacion 
                                 : (puntajeFinal ?? puntajeClasificacion); // Usa Final, con Clasificatoria como fallback

    // Selección de medalla solo en fase FINAL
    let medalla: tipo_premio | null = null;
    if (faseActual === 'FINAL') {
      const premiosFinal = inscripcion.premios.filter(p => p.fuente === 'FINAL');
      // Asegura usar el premio con fuente 'FINAL' si existe, si no, el primer premio
      const premio = premiosFinal.length > 0 ? premiosFinal[0] : inscripcion.premios[0] ?? null; 
      medalla = premio?.tipo ?? null;
    }

    return {
      idInscripcion: inscripcion.id_inscripcion,
      name: `${inscripcion.competidor?.nombres ?? 'N/A'} ${inscripcion.competidor?.apellidos ?? ''}`.trim(),
      ci: inscripcion.competidor?.ci ?? 'N/A',
      area: inscripcion.area?.nombre_area ?? 'N/A',
      school: inscripcion.competidor?.escuela ?? null,
      city: inscripcion.competidor?.departamento ?? null,
      year: inscripcion.gestion?.anio ?? 0,
      score: puntaje,
      medal: medalla,
      status: inscripcion.estado_inscripcion,
    };
  }

  // --------------------- ENDPOINTS ----------------------

  async getCompetidoresClasificatoria(idArea?: number): Promise<CompetidorListadoDto[]> {
    const { id_gestion: idGestion } = await this.obtenerGestionActiva();

    const faseClasificatoria = await this.prisma.fases.findFirst({ where: { nombre_fase: 'Clasificatoria' } });
    const idFaseClasif = faseClasificatoria?.id_fase ?? 1;

    // Filtro basado en cierres_fase VALIDADO
    const idAreasCerradas = await this.getIdsAreasCerradas(idGestion, idFaseClasif);
    if (idAreasCerradas.length === 0 && !idArea) return [];

    const where: Prisma.inscripcionesWhereInput = {
      id_gestion: idGestion,
      puntaje_clasificacion: { not: null },
    };

    if (idArea) where.id_area = idArea;
    else where.id_area = { in: idAreasCerradas };

    const include = { competidor: true, area: true, gestion: true, premios: true };

    const inscripciones = await this.prisma.inscripciones.findMany({
      where,
      orderBy: { puntaje_clasificacion: 'desc' },
      include,
    });

    return inscripciones.map(i => this.mapInscripcionToDto(i, 'CLASIFICATORIA'));
  }

  /**
   * ✅ Filtro simplificado: solo requiere CLASIFICADO y puntaje_final IS NOT NULL.
   * La dependencia de estado_inscripcion se ha comentado en la corrección anterior.
   */
  async getCompetidoresFaseFinal(
    idArea?: number,
    medallaTipo?: tipo_premio | null
  ): Promise<CompetidorListadoDto[]> {
    const { id_gestion: idGestion } = await this.obtenerGestionActiva();

    const where: Prisma.inscripcionesWhereInput = {
      id_gestion: idGestion,
      
      // Filtros clave para mostrar resultados de la Fase Final:
      clasificacion: 'CLASIFICADO', 
      puntaje_final: { not: null }, 

      // Se mantiene comentado el filtro de estado_inscripcion para mayor visibilidad
      // estado_inscripcion: { 
      //   in: [estado_inscripcion.CLASIFICADO, estado_inscripcion.FINALISTA, estado_inscripcion.PREMIADO] 
      // },
    };

    if (idArea) {
      where.id_area = idArea;
    }
    
    if (medallaTipo) {
      where.premios = {
        some: { tipo: medallaTipo, fuente: 'FINAL', id_gestion: idGestion },
      };
    }

    const include = { competidor: true, area: true, gestion: true, premios: true };

    const inscripciones = await this.prisma.inscripciones.findMany({
      where,
      orderBy: { puntaje_final: 'desc' },
      include,
    });

    // Añadimos un log para verificar si la consulta devuelve resultados antes del mapeo
    console.log(`[PrincipalService] Resultados Fase Final encontrados: ${inscripciones.length}`);


    return inscripciones.map(i => this.mapInscripcionToDto(i, 'FINAL'));
  }

  async getCompetidoresHistorico(
    anio: number,
    idArea?: number,
    medallaTipo?: tipo_premio | null
  ): Promise<CompetidorListadoDto[]> {
    const gests = await this.prisma.gestiones.findMany({
      where: { anio, estado: 'CERRADA' },
      select: { id_gestion: true },
    });

    if (gests.length === 0) return [];

    const idGestiones = gests.map(g => g.id_gestion);

    const where: Prisma.inscripcionesWhereInput = {
      id_gestion: { in: idGestiones },
      estado_inscripcion: { in: [estado_inscripcion.FINALISTA, estado_inscripcion.PREMIADO] },
    };

    if (idArea) where.id_area = idArea;
    if (medallaTipo) {
      where.premios = { some: { tipo: medallaTipo, id_gestion: { in: idGestiones } } };
    }

    const include = { competidor: true, area: true, gestion: true, premios: true };

    const inscripciones = await this.prisma.inscripciones.findMany({
      where,
      orderBy: [
        { puntaje_final: 'desc' },
        { puntaje_clasificacion: 'desc' },
      ],
      include,
    });

    return inscripciones.map(i => this.mapInscripcionToDto(i, 'FINAL'));
  }

  async getResumenMedallero(): Promise<MedalleroResumenDto> {
    const gestionActiva = await this.obtenerGestionActiva();
    const idGestion = gestionActiva.id_gestion;

    if (!idGestion) {
      return { anio: gestionActiva.anio, clasificando: 0, medallasOro: 0, medallasPlata: 0, medallasBronce: 0, mencion: 0 };
    }

    const resumenPremios = await this.prisma.premios_otorgados.groupBy({
      by: ['tipo'],
      where: { id_gestion: idGestion, fuente: 'FINAL' },
      _count: { tipo: true },
    });

    // Se asume que "clasificando" aquí se refiere a los finalistas que aún no tienen premio
    const countClasificando = await this.prisma.inscripciones.count({
      where: { id_gestion: idGestion, estado_inscripcion: estado_inscripcion.FINALISTA, puntaje_clasificacion: { not: null } },
    });

    return {
      anio: gestionActiva.anio,
      clasificando: countClasificando,
      medallasOro: resumenPremios.find(r => r.tipo === 'ORO')?._count.tipo ?? 0,
      medallasPlata: resumenPremios.find(r => r.tipo === 'PLATA')?._count.tipo ?? 0,
      medallasBronce: resumenPremios.find(r => r.tipo === 'BRONCE')?._count.tipo ?? 0,
      mencion: resumenPremios.find(r => r.tipo === 'MENCION')?._count.tipo ?? 0,
    };
  }

  async getAniosHistorico(): Promise<number[]> {
    const anios = await this.prisma.gestiones.findMany({
      where: { estado: 'CERRADA' },
      select: { anio: true },
      distinct: ['anio'],
      orderBy: { anio: 'desc' },
    });
    return anios.map(a => a.anio);
  }
}