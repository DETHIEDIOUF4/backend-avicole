import { RoomType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Chaîne vide ou null pour retirer le gérant. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  managerId?: string | null;
}
