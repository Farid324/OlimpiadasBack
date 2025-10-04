export class AreaDto {
  id_area: number;
  nombre_area: string;
  estado: string;
  niveles: {
    id_nivel: number;
    nombre_nivel: string;
    inscritos: number;
  }[];
}
