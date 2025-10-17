import { IsOptional, IsString, Matches } from 'class-validator';

export class QueryEvaluadorDto {
  @IsOptional() @IsString() q?: string;

  // opcional: exactamente 8 dígitos
  @IsOptional()
  @Matches(/^\d{8}$/)
  telefono?: string;

  // opcional: 6–8 dígitos
  @IsOptional()
  @Matches(/^\d{6,8}$/)
  ci?: string;
}
