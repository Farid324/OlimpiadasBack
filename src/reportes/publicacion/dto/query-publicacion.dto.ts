// src/reportes/publicacion/dto/query-publicacion.dto.ts
import { Transform } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

// Esta función helper es perfecta, la reutilizamos
const toNumberOrUndef = (v: unknown) => {
  if (v === undefined || v === null || v === '' || v === '0') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// Renombramos la clase
export class QueryPublicacionDto {
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

  // Tu pestaña no tiene búsqueda 'q', así que la quitamos.
}
