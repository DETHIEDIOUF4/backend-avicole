import { FeedType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateFeedConsumptionDto {
  @IsString()
  roomId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(FeedType)
  feedType!: FeedType;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
