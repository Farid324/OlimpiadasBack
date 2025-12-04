import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class RecoverByEmailDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(150)
  email!: string;
}
