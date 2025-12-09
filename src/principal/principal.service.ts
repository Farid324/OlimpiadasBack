// Ruta: src/principal/principal.service.ts (COMPLETO Y CORREGIDO)
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
    // Si no hay gestión abierta, devuelve id_gestion 0 para que las consultas de "current" devuelvan []
    return gestion ?? { id_gestion: 0, anio: new Date().getFullYear() };
  }

  // --- Obtener ids áreas cerradas
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

  // --- Mapper simplificado (Robusto contra nulos) ---
  private mapInscripcionToDto(
    inscripcion: InscripcionIncluida,
    faseActual: 'CLASIFICATORIA' | 'FINAL'
  ): CompetidorListadoDto {
    const puntajeClasificacion = inscripcion.puntaje_clasificacion ? Number(inscripcion.puntaje_clasificacion) : null;
    const puntajeFinal = inscripcion.puntaje_final ? Number(inscripcion.puntaje_final) : null;

    let puntaje: number | null = faseActual === 'CLASIFICATORIA' ? puntajeClasificacion : (puntajeFinal ?? puntajeClasificacion);

    // Selección de medalla
    let medalla: tipo_premio | null = null;
    
    // Si estamos en la Fase Final o Histórico
    if (faseActual === 'FINAL') {
        // Busca el premio con fuente 'FINAL'
        const premioFinal = inscripcion.premios?.find(p => p.fuente === 'FINAL');
        medalla = premioFinal?.tipo ?? null;
    }
    // Si no hay premio con fuente FINAL, tomamos el primero si existe (para el histórico, si la fuente no está clara)
    if (faseActual === 'FINAL' && !medalla) {
        medalla = inscripcion.premios?.length > 0 ? inscripcion.premios[0].tipo : null;
    }

    return {
      id: inscripcion.id_inscripcion ?? 0, 
      // Uso de ?. y ?? para proteger contra nulos en competidor/area
      name: `${inscripcion.competidor?.nombres ?? 'N/A'} ${inscripcion.competidor?.apellidos ?? ''}`.trim(),
      ci: inscripcion.competidor?.ci ?? 'N/A',
      area: inscripcion.area?.nombre_area ?? 'N/A',
      school: inscripcion.competidor?.escuela ?? null,
      city: inscripcion.competidor?.departamento ?? null,
      year: inscripcion.gestion?.anio ?? 0,
      score: puntaje,
      medal: medalla,
      status: inscripcion.estado_inscripcion,
    } as CompetidorListadoDto; 
  }

  // --------------------- ENDPOINTS ----------------------

  async getCompetidoresClasificatoria(idArea?: number): Promise<CompetidorListadoDto[]> {
    const { id_gestion: idGestion } = await this.obtenerGestionActiva();
    if (!idGestion) return []; // Si no hay gestión activa, sale.

    const faseClasificatoria = await this.prisma.fases.findFirst({ where: { nombre_fase: 'Clasificatoria' } });
    const idFaseClasif = faseClasificatoria?.id_fase ?? 1;

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

  // ✅ FUNCIÓN CORREGIDA A ESTADO DE PRODUCCIÓN
  async getCompetidoresFaseFinal(
    idArea?: number,
    medallaTipo?: tipo_premio | null 
  ): Promise<CompetidorListadoDto[]> {
    
    // 1. OBTENER GESTIÓN ACTIVA (CLAVE: Filtra automáticamente la gestión 2025 ABIERTA)
    const { id_gestion: idGestion } = await this.obtenerGestionActiva();
    if (!idGestion) return []; // Si no hay gestión activa, no se muestran datos.

    const where: Prisma.inscripcionesWhereInput = {
      // ⭐ FILTRO CLAVE RESTAURADO: Solo busca en la gestión ABIERTA (ej. id_gestion: 1)
      id_gestion: idGestion, 
      
      // Busca competidores en estados de final (CLASIFICADO, FINALISTA, PREMIADO)
      estado_inscripcion: { 
        in: [estado_inscripcion.CLASIFICADO, estado_inscripcion.FINALISTA, estado_inscripcion.PREMIADO] 
      },
    };

    if (idArea) {
        where.id_area = idArea;
    }

    // Si se pasa un medallaTipo, lo aplicamos
    if (medallaTipo) {
      where.premios = {
        some: { 
          tipo: medallaTipo, 
          fuente: 'FINAL' as fuente_lista, 
          // 💡 IMPORTANTE: También filtramos los premios por la misma gestión.
          id_gestion: idGestion 
        },
      };
    }

    const include = { competidor: true, area: true, gestion: true, premios: true };

    const inscripciones = await this.prisma.inscripciones.findMany({
      where,
      // Ordenamos por puntaje final y luego por puntaje de clasificación
      orderBy: [
        { puntaje_final: 'desc' }, 
        { puntaje_clasificacion: 'desc' }
      ],
      include,
    });

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
      // En Histórico, mostramos los que tienen puntaje final O los que tienen premio
      OR: [
        { puntaje_final: { not: null } },
        { premios: { some: { id_gestion: { in: idGestiones } } } }
      ]
    };

    if (idArea) where.id_area = idArea;
    
    // Si se pasa un medallaTipo, lo aplicamos
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

    const countClasificando = await this.prisma.inscripciones.count({
      // Se cuenta a los que están en estado CLASIFICADO o FINALISTA, que tienen puntaje de clasificación.
      where: { id_gestion: idGestion, estado_inscripcion: { in: [estado_inscripcion.CLASIFICADO, estado_inscripcion.FINALISTA] }, puntaje_clasificacion: { not: null } },
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