// src/fases/dto/close-phase.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PhaseType {
  CLASIFICACION = 'CLASIFICACION',
  FINAL = 'FINAL',
}

export class ClosePhaseDto {
  @IsEnum(PhaseType, {
    message: 'El campo "type" debe ser "CLASIFICACION" o "FINAL".',
  })
  type!: PhaseType;

  @IsOptional()
  @IsString({ message: 'El campo "comentario" debe ser un texto.' })
  comentario?: string;
}
