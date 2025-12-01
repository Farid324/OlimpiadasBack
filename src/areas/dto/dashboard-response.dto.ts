// src/areas/dto/dashboard-response.dto.ts

// Tipo para el detalle por Área/Nivel (lo que tu función ya calcula)
export type AreaNivelStats = {
  id_area: number;
  nombre_area: string;
  estado: 'EVALUANDO' | 'CLASIFICANDO' | 'COMPLETADO';
  id_nivel: number;
  nombre_nivel: string;
  total_inscritos: number;
};

// Tipos para las 7 tarjetas de métricas globales
export type DashboardMetrics = {
  totalOlimpiadas: number;
  totalRegistros: number; // Total Olimpistas (Inscripciones)
  totalAreas: number;
  totalEvaluadores: number;
  totalResponsables: number; // <--- NUEVA MÉTRICA
  areasEnEvaluacion: number;
  totalClasificados: number;
  totalPremiados: number;
  areasActivas: number;
};

// Respuesta final completa (el objeto que espera el frontend)
export type DashboardResponse = {
  metrics: DashboardMetrics;
  areasStats: AreaNivelStats[];
};
