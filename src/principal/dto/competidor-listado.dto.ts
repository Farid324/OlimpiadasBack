// src/principal/dto/competidor-listado.dto.ts
import { estado_inscripcion, tipo_premio } from '@prisma/client';

export class CompetidorListadoDto {
  idInscripcion: number;
  name: string;
  ci: string;
  area: string;
  school: string | null;
  city: string | null;
  year: number;
  score: number | null; // puntaje_clasificacion o puntaje_final
  medal: tipo_premio | null; // ORO, PLATA, BRONCE, MENCION
  status: estado_inscripcion; // INSCRITO, CLASIFICADO, PREMIADO, etc.
  faseLlegada?: 'CLASIFICATORIA' | 'FINAL'; // Sólo para histórico (opcional)
}
