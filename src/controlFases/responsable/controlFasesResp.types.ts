// src/controlFases/responsable/controlFasesResp.types.ts

export type AccionColor = 'primary' | 'neutral' | 'success';
export type EstadoUI = 'En progreso' | 'Completado' | 'Listo para aprobar';
export type FaseActual = 'Clasificación' | 'Evaluación Final' | 'Completado';

export type ResumenClasificacion = {
  clasificados: number;
  noClasificados: number;
  descalificados: number;
};

export type FilaFase = {
  id: string;
  idArea: number;
  idNivel: number;
  area: string;
  nivel: string;
  faseActual: FaseActual;
  progresoHecho: number;
  progresoTotal: number;
  resumen: ResumenClasificacion;
  responsable: string;
  fechaHora: string;
  estado: EstadoUI;
  accionLabel?: string;
  accionColor?: AccionColor;
  accionDisabled?: boolean;
};

export type ControlFasesResponse = {
  kpis: {
    evaluacionesCompletadas: { valor: number; total: number };
    fasesCompletadas: { valor: number; total: number };
    aprobacionesPendientes: { valor: number; nota: string };
    progresoGeneral: { porcentaje: number; nota: string };
  };
  filas: FilaFase[];
};
