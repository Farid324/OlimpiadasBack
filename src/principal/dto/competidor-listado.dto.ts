// DTOs para simplificar las firmas de los métodos y manejar la estructura de datos.

import { clasificacion_estado, tipo_premio } from '@prisma/client';

/**
 * Filtros de búsqueda comunes para el front-end.
 */
export interface CompetitorFilterDto {
  areaId?: number;
  levelId?: number;
  searchCiOrName?: string;
  medalType?: tipo_premio;
}

/**
 * Estructura de respuesta para un competidor, incluyendo detalles para el Front-end.
 */
export interface CompetitorDetails {
  id_inscripcion: number;
  nombreCompleto: string;
  ci: string;
  escuela: string;
  departamento: string;
  area: string;
  nivel: string;
  gestionAnio: number;
  
  // Datos de Fase Clasificatoria
  puntajeClasificacion: number | null;
  estadoClasificacion: clasificacion_estado; // CLASIFICADO | NO_CLASIFICADO | DESCALIFICADO
  
  // Datos de Fase Final / Histórico
  puntajeFinal: number | null;
  medalla: tipo_premio | null; // ORO | PLATA | BRONCE | MENCION
  
  // Opcional: estado de inscripción general (para la Fase Final)
  estadoInscripcion: string;
}

/**
 * Estructura de respuesta para la lista de gestiones históricas.
 */
export interface HistoricalGestionDto {
  id_gestion: number;
  anio: number;
  nombre: string;
}