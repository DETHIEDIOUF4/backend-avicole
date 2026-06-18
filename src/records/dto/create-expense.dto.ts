import { ExpenseCategory, FeedType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  roomId?: string;

  @IsDateString()
  date!: string;

  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(FeedType)
  feedType?: FeedType;

  @IsOptional()
  @IsInt()
  @Min(1)
  feedQuantity?: number;
}
