// src/gestiones/dto/open-gestion.dto.ts
import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class OpenGestionDto {
  @IsInt()
  @Min(2000)
  anio: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;
}
