import { PartialType } from '@nestjs/mapped-types';
import { CreateResponsableDto } from './create-responsable.dto';
import { IsOptional, IsString, IsEmail, Matches, IsInt, Min, Max } from 'class-validator';

export class UpdateResponsableDto extends PartialType(CreateResponsableDto) {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/, { message: 'El nombre solo puede contener letras' })
  nombre?: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Debe ingresar un correo válido' })
  correo?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  ci?: string;

  @IsOptional()
  @IsString()
  institucion?: string;

  @IsOptional()
  @IsString()
  especialidad?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'La experiencia mínima es 1 año' })
  @Max(30, { message: 'La experiencia máxima es 30 años' })
  experiencia?: number;

  @IsOptional()
  @IsInt()
  id_area?: number;
}
