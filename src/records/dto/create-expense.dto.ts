import { ExpenseCategory } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
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
}
