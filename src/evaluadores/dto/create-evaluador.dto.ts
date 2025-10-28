// src/evaluadores/dto/create-evaluador.dto.ts
import {
  IsArray,
  ArrayNotEmpty,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateEvaluadorDto {
  // Opción A: puedes enviar nombre y apellido por separado…
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/, {
    message: 'nombre solo permite letras y espacios',
  })
  nombre?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/, {
    message: 'apellido solo permite letras y espacios',
  })
  apellido?: string;

  // …u Opción B: enviar nombreCompleto (lo estás usando en el modal)
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/, {
    message: 'nombreCompleto solo permite letras y espacios',
  })
  nombreCompleto?: string;

  @IsEmail({}, { message: 'correo inválido' })
  correo!: string;

  // Teléfono: exactamente 8 dígitos
  @IsString()
  @Matches(/^\d{8}$/, { message: 'el teléfono debe tener 8 dígitos' })
  telefono!: string;

  // 🔹 CI: 6–8 dígitos (ahora permitido)
  @IsOptional()
  @IsString()
  @Matches(/^\d{6,8}$/, { message: 'el CI debe tener entre 6 y 8 dígitos' })
  ci?: string;

  @IsString()
  @Matches(/^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/, {
    message: 'institución solo permite letras y espacios',
  })
  institucion!: string;

  @IsString()
  @IsNotEmpty({ message: 'la especialidad es obligatoria' })
  especialidad!: string;

  @IsInt()
  @Min(1, { message: 'experiencia mínima 1 año' })
  @Max(30, { message: 'experiencia máxima 30 años' })
  experiencia!: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // Áreas: arreglo de ids (lo envías como id_areas)
  @IsArray({ message: 'id_areas debe ser un arreglo' })
  @ArrayNotEmpty({ message: 'debe incluir al menos un área' })
  @IsInt({ each: true, message: 'cada id de área debe ser entero' })
  id_areas!: number[];
}
