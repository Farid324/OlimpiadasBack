//src/responsables/dto/create-responsable.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

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

  // ⬇Teléfono OPCIONAL: si viene, valida 8 dígitos y que empiece con 6 o 7
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, {
    message: 'el teléfono debe tener exactamente 8 dígitos',
  })
  @Matches(/^[67]/, {
    message: 'el teléfono debe iniciar con 6 o 7',
  })
  telefono?: string; // ahora opcional

  // Institución OPCIONAL
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsOptional()
  @IsString()
  institucion?: string; // opcional

  // Experiencia OPCIONAL (default=1 en el service)
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  experiencia?: number; // opcional

  // Especialidad OPCIONAL
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsOptional()
  @IsString()
  especialidad?: string; // opcional

  @IsNumber()
  id_area: number;
}
