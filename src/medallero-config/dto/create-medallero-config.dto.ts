//src/medallero-config/dto/create-medallero-config.dto.ts
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateMedalleroConfigDto {
  @IsInt()
  id_area: number;

  @IsInt()
  id_nivel: number; // ✨ AÑADIDO: Necesario para la configuración por Nivel

  @IsInt()
  @Min(0)
  oros: number;

  @IsInt()
  @Min(0)
  platas: number;

  @IsInt()
  @Min(0)
  bronces: number;

  @IsInt()
  @Min(0)
  menciones: number;

  @IsOptional()
  vigente_desde?: Date;

  @IsOptional()
  vigente_hasta?: Date;
}