import { IsArray, IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateEvaluadorDto {
  @IsString() @IsNotEmpty()
  nombreCompleto: string;   // ← lo recibiremos así

  @IsEmail()
  correo: string;

  @IsOptional() @IsString()
  telefono?: string;

  @IsOptional() @IsString()
  institucion?: string;

  @IsOptional() @IsString()
  especialidad?: string;

  @IsOptional() @IsInt() @Min(0)
  experiencia?: number;

  @IsArray()
  id_areas: number[];

  @IsOptional() @IsBoolean()
  responsable?: boolean;
}
