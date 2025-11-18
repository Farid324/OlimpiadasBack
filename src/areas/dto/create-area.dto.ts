import { IsString, IsInt, IsEnum, Min, Max, IsOptional } from 'class-validator';

export class CreateAreaDto {
  @IsString()
  nombre_area: string;

  @IsInt()
  @Min(51)
  @Max(100)
  nota_aprobacion: number;

  @IsEnum(['INDIVIDUAL', 'GRUPAL'])
  tipo: 'INDIVIDUAL' | 'GRUPAL';

  @IsString()
  @IsOptional()
  niveles_target?: string; // Ejemplo: "Primaria, Secundaria"
}
