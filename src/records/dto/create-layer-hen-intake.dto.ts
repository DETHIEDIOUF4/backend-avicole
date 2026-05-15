import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLayerHenIntakeDto {
  @IsString()
  roomId!: string;

  @IsDateString()
  date!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  /** Prix unitaire d’achat (FCFA / tête). Total dépense enregistré = quantité × prix unitaire. */
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
