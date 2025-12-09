// Ruta: src/principal/dto/competidor-listado.dto.ts (CORREGIDO)
import { estado_inscripcion, tipo_premio } from '@prisma/client';

export class CompetidorListadoDto {
  // 🛑 CAMBIO CLAVE: Renombrar idInscripcion a id
  id: number; 
  name: string;
  ci: string;
  area: string;
  school: string | null;
  city: string | null;
  year: number;
  score: number | null; 
  medal: tipo_premio | null; 
  status: estado_inscripcion; 
  faseLlegada?: 'CLASIFICATORIA' | 'FINAL'; 
}