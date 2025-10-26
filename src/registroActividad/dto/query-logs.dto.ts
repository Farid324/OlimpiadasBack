import { IsOptional, IsNumber, IsString } from 'class-validator';

export class QueryLogsDto {
  @IsOptional()
  @IsNumber()
  id_evaluacion?: number;

  @IsOptional()
  @IsNumber()
  id_usuario?: number;

  @IsOptional()
  @IsString()
  accion?: 'REGISTRO' | 'MODIFICACION';

  @IsOptional()
  @IsString()
  fecha_inicio?: string; // ISO

  @IsOptional()
  @IsString()
  fecha_fin?: string; // ISO
}

