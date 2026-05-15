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

  /** Poulettes / pondeuses : unités. Œufs : nombre de tablettes (× 30 œufs en stock). */
  @IsInt()
  @Min(1)
  quantity!: number;

  /** Poulettes / pondeuses : prix à la tête. Œufs : prix pour une tablette (30 œufs). */
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
