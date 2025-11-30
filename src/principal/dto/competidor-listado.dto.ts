export class CompetidorListadoDto {
  // Atributos de la tabla/front
  idInscripcion: number; // id_inscripcion
  nombre: string; // Nombre Completo del competidor
  ci: string; // CI del competidor
  area: string; // Nombre del Área
  colegio: string | null; // Escuela del competidor (competidores.escuela)
  ciudad: string | null; // Departamento del competidor (competidores.departamento)
  anio: number; // anio de la gestión (gestiones.anio)
  
  // Atributos de estado y puntaje
  puntaje: number | null; // puntaje_clasificacion o puntaje_final
  medalla: 'ORO' | 'PLATA' | 'BRONCE' | 'MENCION' | null;
  
  // Estado general de la inscripción (INSCRITO, CLASIFICADO, FINALISTA, PREMIADO, DESCALIFICADO)
  estadoInscripcion: 'INSCRITO' | 'CLASIFICADO' | 'FINALISTA' | 'PREMIADO' | 'DESCALIFICADO';
  
  // Opcional para Histórico
  faseLlegada?: 'CLASIFICATORIA' | 'FINAL'; 
}