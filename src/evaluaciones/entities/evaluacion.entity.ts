// src/modules/evaluaciones/entities/evaluacion.entity.ts
export class Evaluacion {
  id_evaluacion: number;
  id_inscripcion: number;
  id_fase: number;
  id_evaluador: number;
  nota: number | null;
  fecha_registro: Date;
  estado_registro: 'BORRADOR' | 'FINALIZADO';
  comentario?: string;
}
