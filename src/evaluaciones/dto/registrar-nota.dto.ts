import { IsNumber, Min, Max, IsOptional, IsString } from 'class-validator';

export class RegistrarNotaDto {
  @IsNumber()
  @Min(1)
  @Max(100)
  nota: number;

  @IsOptional()
  @IsString()
  comentario?: string;
}
