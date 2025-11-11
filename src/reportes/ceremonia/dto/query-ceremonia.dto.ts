// src/reportes/ceremonia/dto/query-ceremonia.dto.ts
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

const toNumberOrUndef = (v: unknown) => {
  if (v === undefined || v === null || v === '' || v === '0') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export class QueryCeremoniaDto {
  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsInt()
  id_area?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsInt()
  id_nivel?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsInt()
  anio?: number;

  @IsOptional()
  @IsString()
  q?: string;
}
