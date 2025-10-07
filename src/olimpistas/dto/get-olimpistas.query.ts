// src/olimpistas/dto/get-olimpistas.query.ts

import { IsOptional, IsString } from 'class-validator';

export class GetOlimpistasQueryDto {
  @IsOptional()
  @IsString()
  area?: string;
  @IsOptional()
  @IsString()
  q?: string;
}
