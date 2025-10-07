import { IsOptional, IsString } from 'class-validator';

export class QueryEvaluadorDto {
  @IsOptional() @IsString() q?: string;
}
