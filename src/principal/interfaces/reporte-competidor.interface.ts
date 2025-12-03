// src/principal/interfaces/reporte-competidor.interface.ts (Asegúrate de que tus tipos son así)

import { tipo_premio, clasificacion_estado } from '@prisma/client';

export type MedalType = tipo_premio | null;
export type ClasificacionEstado = clasificacion_estado | null;

export interface ReporteCompetidor {
  nombre_completo: string;
  ci: string;
  area: string;
  nivel: string;
  escuela: string;
  departamento: string;
  anio: number; // Ahora se tomará de la inscripción
  
  puntaje_clasificacion: number | null;
  puntaje_final: number | null;
  puntaje_mostrado: number;

  clasificacion_estado: ClasificacionEstado;
  tipo_premio: MedalType;
}

export interface ReporteActualResponse {
    competidores: ReporteCompetidor[];
    estadisticas: {
        total_inscritos: number;
        medallas_oro: number;
        medallas_plata: number;
        medallas_bronce: number;
        menciones: number;
    };
}