//src/responsables/dto/update-responsable.dto.ts
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer'; // AÑADIDO

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

  // Teléfono: sólo se valida si NO viene vacío.
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
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
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined; // no actualizar experiencia
    }
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  })
  @IsNumber()
  @Min(1)
  @Max(30)
  experiencia?: number;

  // Permitir cambiar el área al editar (ya lo tenías)
  @IsOptional()
  @IsNumber()
  id_area?: number;
}
