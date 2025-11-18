// src/controlFases/controlFases.types.ts

export type PhaseTypeCF = 'CLASIFICACION' | 'FINAL';

export type AccionColor = 'primary' | 'neutral' | 'success';

export type FilaFase = {
  id: string;
  idArea: number;
  idNivel: number;
  area: string;
  nivel: string;
  faseActual: 'Clasificación' | 'Evaluación Final' | 'Completado';
  progresoHecho: number;
  progresoTotal: number;
  resumen: {
    clasificados: number;
    noClasificados: number;
    descalificados: number;
  };
  responsable: string;
  fechaHora: string;
  estado: 'En progreso' | 'Completado' | 'Listo para aprobar';
  accionLabel?: string;
  accionColor?: AccionColor;
  accionDisabled?: boolean;
};

export type ControlFasesResponse = {
  kpis: {
    evaluacionesCompletadas: { valor: number; total: number };
    fasesCompletadas: { valor: number; total: number };
    aprobacionesPendientes: { valor: number; nota?: string };
    progresoGeneral: { porcentaje: number; nota?: string };
  };
  filas: FilaFase[];
};
