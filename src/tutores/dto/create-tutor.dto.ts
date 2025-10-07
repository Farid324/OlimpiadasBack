// src/tutores/dto/create-tutor.dto.ts

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTutorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombreCompleto!: string;

  @IsOptional()
  @Matches(/^\d{5,12}$/, { message: 'CI inválido' })
  ci?: string;

  @IsOptional()
  @IsEmail()
  correo?: string;

  @IsString()
  @Matches(/^\d{7,12}$/, { message: 'Teléfono inválido' })
  telefono!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  unidadEducativa?: string;
}
