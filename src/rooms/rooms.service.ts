import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

type AuthUser = { sub: string; role: UserRole };

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoomDto) {
    if (dto.managerId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.managerId },
      });
      if (!manager || manager.role !== UserRole.MANAGER) {
        throw new BadRequestException('managerId invalide');
      }
    }
    return this.prisma.room.create({ data: dto });
  }

  async list(user: AuthUser) {
    return this.prisma.room.findMany({
      where: user.role === UserRole.ADMIN ? {} : { managerId: user.sub },
      include: {
        manager: { select: { id: true, phone: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateRoomDto) {
    const exists = await this.prisma.room.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Salle introuvable');
    }
    const data: {
      name?: string;
      type?: RoomType;
      capacity?: number | null;
      isActive?: boolean;
      managerId?: string | null;
    } = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.type !== undefined) {
      data.type = dto.type;
    }
    if (dto.capacity !== undefined) {
      data.capacity = dto.capacity;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }
    if (dto.managerId !== undefined) {
      if (dto.managerId === null || dto.managerId === '') {
        data.managerId = null;
      } else {
        const manager = await this.prisma.user.findUnique({
          where: { id: dto.managerId },
        });
        if (!manager || manager.role !== UserRole.MANAGER) {
          throw new BadRequestException('managerId invalide');
        }
        data.managerId = dto.managerId;
      }
    }
    return this.prisma.room.update({ where: { id }, data });
  }

  /** Supprime la salle et toutes les données liées (admin uniquement). */
  async remove(id: string) {
    const exists = await this.prisma.room.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Salle introuvable');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({ where: { roomId: id } });
      await tx.room.delete({ where: { id } });
    });
    return { deleted: true, id };
  }

  async assertManagerRoomAccess(user: AuthUser, roomId: string, expectedType?: RoomType) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Salle introuvable');
    }
    if (user.role !== UserRole.ADMIN && room.managerId !== user.sub) {
      throw new ForbiddenException('Acces refuse a cette salle');
    }
    if (expectedType && room.type !== expectedType) {
      throw new BadRequestException(`Operation reservee aux salles ${expectedType}`);
    }
    return room;
  }
}
