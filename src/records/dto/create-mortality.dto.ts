import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateMortalityDto {
  @IsString()
  roomId!: string;

  @IsDateString()
  date!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  cause?: string;
}
