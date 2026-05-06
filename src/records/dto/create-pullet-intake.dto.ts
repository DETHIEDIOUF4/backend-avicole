import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePulletIntakeDto {
  @IsString()
  roomId!: string;

  @IsDateString()
  date!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
