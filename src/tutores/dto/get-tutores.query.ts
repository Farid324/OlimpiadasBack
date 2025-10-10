//src/tutores/dto/get-tutores.query.ts

import { IsOptional, IsString } from 'class-validator';

export class GetTutoresQueryDto {
  @IsOptional() @IsString()
  q?: string; // búsqueda libre: nombre, ci, correo, teléfono, unidad educativa
}
