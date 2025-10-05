import { IsEmail, IsNotEmpty, IsString, IsNumber, Min, Max } from 'class-validator';

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

  @IsString()
  telefono: string;

  @IsString()
  institucion: string;

  @IsNumber()
  @Min(0)
  @Max(50)
  experiencia: number;

  @IsString()
  especialidad: string;
  
    @IsNumber()
  id_area: number;
}
