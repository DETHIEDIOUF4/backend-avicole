import { StockDirection, StockItemType, StockMovementReason, FeedType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateStockMovementDto {
  @IsString()
  roomId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(StockItemType)
  itemType!: StockItemType;

  @IsOptional()
  @IsEnum(FeedType)
  feedType?: FeedType;

  @IsEnum(StockDirection)
  direction!: StockDirection;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsEnum(StockMovementReason)
  reason!: StockMovementReason;

  @IsOptional()
  @IsString()
  notes?: string;
}
