// src/olimpistas/dto/registro-olimpista.dto.ts

import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  IsInt,
  Max,
  Min,
  IsOptional,
  MaxLength,
  MinLength,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

const TEXT_RX = /^[\p{L}\p{N}\s.\-']+$/u;
const NUM_RX = /^\d+$/;

export class RegistroOlimpistaDto {
  @IsString({ message: 'El nombre completo debe ser texto.' })
  @IsNotEmpty()
  @Matches(TEXT_RX, {
    message: 'El nombre solo permite letras, espacios y (.’-).',
  })
  @MinLength(1, { message: 'El nombre completo es obligatorio.' })
  nombreCompleto!: string;

  @IsString({ message: 'La cédula debe ser texto numérico.' })
  @IsNotEmpty({ message: 'Ci obligatorio.' })
  @Matches(NUM_RX, { message: 'La cédula solo permite dígitos.' })
  @Length(6, 12, { message: 'La cédula debe tener entre 6 y 12 dígitos.' })
  ci!: string;

  @IsString({ message: 'El contacto del tutor debe ser texto numérico.' })
  @IsNotEmpty()
  @Matches(NUM_RX, { message: 'El contacto del tutor solo permite dígitos.' })
  @Length(7, 12, {
    message: 'El contacto del tutor debe tener entre 7 y 12 dígitos.',
  })
  @Transform(({ value }) => (value ?? '').toString().trim())
  @IsNotEmpty({
    message: 'Debe registrar un tutor antes de asociar un olimpista.',
  })
  @Matches(/^\d{7,12}$/, {
    message: 'El contacto del tutor debe tener entre 7 y 12 dígitos.',
  })
  tutorContacto!: string;

  @IsString({ message: 'La Unidad Educativa debe ser texto.' })
  @IsNotEmpty()
  @MaxLength(80, { message: 'Unidad Educativa: máximo 80 caracteres.' })
  @Matches(TEXT_RX, {
    message: 'Unidad Educativa solo permite letras, espacios y (.’-).',
  })
  unidadEducativa!: string;

  @IsString({ message: 'El departamento es obligatorio.' })
  @IsIn(
    [
      'La Paz',
      'Pando',
      'Beni',
      'Santa Cruz',
      'Chuquisaca',
      'Oruro',
      'Potosí',
      'Cochabamba',
      'Tarija',
    ],
    { message: 'Departamento inválido.' },
  )
  departamento!: string;

  @IsOptional()
  @IsIn(
    [
      '1ºP',
      '2ºP',
      '3ºP',
      '4ºP',
      '5ºP',
      '6ºP',
      '1ºS',
      '2ºS',
      '3ºS',
      '4ºS',
      '5ºS',
      '6ºS',
    ],
    { message: 'El código de grado escolar debe ser texto.' },
  )
  @MaxLength(8, { message: 'Código de grado escolar demasiado largo.' })
  gradoEscolar?: string;

  @IsString({ message: 'El área es obligatoria.' })
  @IsNotEmpty()
  area!: string;

  @IsString({ message: 'Seleccione el nivel de competencia.' })
  @IsNotEmpty()
  nivel!: string;

  @IsOptional()
  @IsIn(['Primaria', 'Secundaria'], {
    message: 'Seleccione el nivel de competencia.',
  })
  nivelCompetidor?: 'Primaria' | 'Secundaria';

  @IsOptional()
  @IsInt({ message: 'El grado debe ser un número entero.' })
  @Min(1, { message: 'El grado debe estar entre 1 y 6.' })
  @Max(6, { message: 'El grado debe estar entre 1 y 6.' })
  grado?: number;
}

export class RegistroOlimpistaBulkDto {
  data!: RegistroOlimpistaDto[];
}
