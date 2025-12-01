//src/responsables/dto/create-responsable.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional, // ⬅️ AÑADIDO
  Matches, // ⬅️ AÑADIDO
} from 'class-validator';
import { Transform } from 'class-transformer'; // ⬅️ AÑADIDO

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

  // ⬇️ Teléfono OPCIONAL: si viene, valida 8 dígitos y que empiece con 6 o 7
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
  telefono: string;

  // Institución OPCIONAL (si no envías nada, no se valida)
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsOptional()
  @IsString()
  institucion: string;

  // Experiencia OPCIONAL (la lógica de default=1 se hará en el service)
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  experiencia: number;

  // Especialidad OPCIONAL
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsOptional()
  @IsString()
  especialidad: string;

  @IsNumber()
  id_area: number;
}
