// src/evaluaciones/dto/registrar-nota.dto.ts
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class RegistrarNotaDto {
  @IsInt()
  idInscripcion: number;

  @IsInt()
  idEvaluador: number;

  @IsNumber()
  nota: number;

  @IsOptional()
  @IsString()
  descripConceptual?: string | null;
  comentario?: string | null;
}

export class EditarNotaDto {
  @IsInt()
  idEvaluacion: number;

  @IsInt()
  idUsuario: number;

  @IsOptional()
  @IsInt()
  idEvaluador?: number;

  @IsNumber()
  nuevaNota: number;

  @IsOptional()
  @IsString()
  descripConceptual?: string | null;
  comentario?: string | null;
}
