//src/evaluadores/dto/update-evaluador.dto.ts
import {
  IsOptional,
  IsString,
  IsEmail,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsInt,
} from 'class-validator';

export class UpdateEvaluadorDto {
  // Puedes mandar nombreCompleto o nombre+apellido
  @IsOptional() @IsString() nombreCompleto?: string;
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() apellido?: string;

  @IsOptional() @IsEmail() correo?: string;
  @IsOptional() @IsString() telefono?: string; // validado en servicio (8 dígitos)
  @IsOptional() @IsString() ci?: string; // validado en servicio (6–8 dígitos)
  @IsOptional() @IsString() institucion?: string;
  @IsOptional() @IsString() especialidad?: string;

  // Mantengo tu regla 1–30 (ajusta si quieres)
  @IsOptional() @IsNumber() @Min(1) @Max(30) experiencia?: number;

  // Áreas nuevas a vincular
  @IsOptional() @IsArray() @IsInt({ each: true }) id_areas?: number[];
}