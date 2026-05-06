import { IsNumber, Min } from 'class-validator';

export class UpdateSalesPricingDto {
  @IsNumber()
  @Min(0)
  eggUnitPrice!: number;

  @IsNumber()
  @Min(0)
  pulletUnitPrice!: number;

  @IsNumber()
  @Min(0)
  layerHenUnitPrice!: number;
}
