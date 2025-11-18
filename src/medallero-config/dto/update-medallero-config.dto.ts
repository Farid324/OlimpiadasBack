//src/medallero-config/dto/update-medallero-config.dto.ts
import { IsInt, Min, IsOptional } from 'class-validator';

export class UpdateMedalleroConfigDto {
  @IsInt()
  id_area: number;

  @IsInt()
  id_nivel: number; // ✨ AÑADIDO: Necesario para crear si id_medallero es 0

  @IsInt()
  @Min(0)
  @IsOptional()
  oros?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  platas?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  bronces?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  menciones?: number;
}

