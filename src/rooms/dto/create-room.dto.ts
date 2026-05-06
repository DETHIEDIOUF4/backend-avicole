import { RoomType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name!: string;

  @IsEnum(RoomType)
  type!: RoomType;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  managerId?: string;
}
