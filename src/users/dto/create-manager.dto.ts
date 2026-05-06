import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateManagerDto {
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'Numéro de téléphone invalide' })
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(2)
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
