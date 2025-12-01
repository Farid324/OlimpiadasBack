// src/olimpistas/dto/update-olimpista.dto.ts
import { RegistroOlimpistaDto } from './registro-olimpista.dto';

/**
 * DTO para actualización de olimpistas.
 * Reutiliza las mismas validaciones que RegistroOlimpistaDto.
 * La idea es enviar el registro completo al editar.
 */
export class UpdateOlimpistaDto extends RegistroOlimpistaDto {}
