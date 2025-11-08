import { IsEmail, IsNumber, IsOptional, IsString, Length, Matches, Min, Max } from 'class-validator';

export class UpdateResponsableDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/)
  nombre?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]*$/)
  apellido?: string;

  @IsOptional()
  @IsEmail()
  correo?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  @Length(8, 8)
  telefono?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  @Length(6, 8)
  ci?: string;

  @IsOptional()
  @IsString()
  institucion?: string;

  @IsOptional()
  @IsString()
  especialidad?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  experiencia?: number;

  // ✔︎ NUEVO: permitir cambiar el área al editar
  @IsOptional()
  @IsNumber()
  id_area?: number;
}