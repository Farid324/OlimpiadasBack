// src/responsables/dto/filter-responsable.dto.ts
import { IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class FilterResponsableDto {
  @IsOptional()
  @IsNumber()
  id_area?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
