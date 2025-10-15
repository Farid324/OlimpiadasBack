// src/grupos/dto/create-grupo.dto.ts

import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { CreateTutorDto } from '../../tutores/dto/create-tutor.dto';

const TEXT_RX = /^[\p{L}\p{N}\s.\-']+$/u;
const NUM_RX = /^\d+$/;

export class MiembroGrupoDto {
  @IsString()
  @IsNotEmpty()
  @Matches(TEXT_RX)
  nombreCompleto!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(NUM_RX)
  ci!: string;

  @IsOptional()
  @IsIn([
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
  ])
  gradoEscolar!: string;

  @IsOptional()
  @IsString()
  @Matches(NUM_RX)
  tutorContacto?: string;

  @IsOptional()
  @IsString()
  departamento?: string;

  @IsOptional()
  @IsIn(['Primaria', 'Secundaria'])
  nivelCompetidor?: 'Primaria' | 'Secundaria';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  grado?: number;
}

export class CreateGrupoDto {
  @IsString()
  @IsNotEmpty()
  @Matches(TEXT_RX)
  nombreEquipo!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(TEXT_RX)
  unidadEducativa!: string;

  @IsString()
  @IsIn([
    'La Paz',
    'Pando',
    'Beni',
    'Santa Cruz',
    'Chuquisaca',
    'Oruro',
    'Potosí',
    'Cochabamba',
    'Tarija',
  ])
  departamento!: string;

  @IsString()
  @IsNotEmpty()
  area!: string;

  @IsString()
  @IsNotEmpty()
  nivel!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MiembroGrupoDto)
  miembros!: MiembroGrupoDto[];

  @IsOptional()
  @IsIn(['Primaria', 'Secundaria'])
  nivelCompetidor?: 'Primaria' | 'Secundaria';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  grado?: number;

  @IsOptional()
  @IsInt()
  tutorId?: number;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{7,12}$/, { message: 'Teléfono inválido para tutor' })
  tutorTelefono?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateTutorDto)
  tutorPayload?: CreateTutorDto;
}
