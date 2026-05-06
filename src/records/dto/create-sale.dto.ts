import { SaleItemType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  Min,
} from 'class-validator';

export class CreateSaleDto {
  @IsString()
  roomId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(SaleItemType)
  itemType!: SaleItemType;

  @IsString()
  @MinLength(2)
  customerName!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
