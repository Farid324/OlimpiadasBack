// src/gestiones/dto/olimpistas-historial.query.ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OlimpistasHistorialQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
