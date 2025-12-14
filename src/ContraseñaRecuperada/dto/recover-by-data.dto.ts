import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RecoverByDataDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string; // nombre completo (se compara sin importar may/min)

  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  ci!: string;
}
