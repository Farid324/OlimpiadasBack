// src/evaluadores/dto/asignar-olimpistas.dto.ts
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class AsignacionEvaluadorInput {
  @IsInt()
  @Min(1)
  id_usuario!: number;

  // Cantidad de olimpistas en fase clasificatoria
  @IsOptional()
  @IsInt()
  @Min(0)
  cupo_clasificacion?: number;

  // Cantidad de olimpistas en fase final
  @IsOptional()
  @IsInt()
  @Min(0)
  cupo_final?: number;
}

export class AsignarOlimpistasDto {
  @IsInt()
  @Min(1)
  id_area!: number;

  @IsArray()
  @ArrayNotEmpty()
  @Type(() => AsignacionEvaluadorInput)
  asignaciones!: AsignacionEvaluadorInput[];
}
