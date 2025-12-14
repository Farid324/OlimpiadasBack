//src/responsables/dto/create-responsable.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateResponsableDto {
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  apellido: string;

  @IsNotEmpty()
  @IsString()
  ci: string;

  @IsEmail()
  correo: string;

  // Teléfono OPCIONAL
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : String(value).trim() === ''
        ? undefined
        : String(value).trim(),
  )
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'el teléfono debe tener exactamente 8 dígitos' })
  @Matches(/^[67]/, { message: 'el teléfono debe iniciar con 6 o 7' })
  telefono?: string;

  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : String(value).trim() === ''
        ? undefined
        : String(value).trim(),
  )
  @IsOptional()
  @IsString()
  institucion?: string;

  // Experiencia OPCIONAL (si llega string, conviértelo a number)
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const v = String(value).trim();
    if (v === '') return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? value : n;
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  experiencia?: number;

  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : String(value).trim() === ''
        ? undefined
        : String(value).trim(),
  )
  @IsOptional()
  @IsString()
  especialidad?: string;

  @IsNumber()
  id_area: number;
}
