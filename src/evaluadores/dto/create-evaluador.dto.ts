import { IsArray, IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min, ArrayNotEmpty } from 'class-validator';

export class CreateEvaluadorDto {
  @IsString()
  @IsNotEmpty()
  nombreCompleto!: string; // lo partimos en nombre + apellido

  @IsEmail()
  correo!: string;

  @IsOptional() @IsString()
  telefono?: string;

  @IsOptional() @IsString()
  institucion?: string;

  @IsOptional() @IsString()
  especialidad?: string;

  @IsOptional() @IsInt() @Min(0)
  experiencia?: number;

  @IsArray() @ArrayNotEmpty()
  @IsInt({ each: true })
  id_areas!: number[];

  @IsOptional() @IsBoolean()
  responsable?: boolean; // si se marca, también lo registramos como responsable de esas áreas
}
