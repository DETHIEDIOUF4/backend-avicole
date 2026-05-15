import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ExpenseCategory,
  Prisma,
  RoomType,
  SaleItemType,
  StockDirection,
  StockItemType,
  StockMovementReason,
  UserRole,
} from '@prisma/client';
import { statsPeriodPayload, type StatsDateRangeFilter } from '../common/stats-date-range';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { CreateLayerHenIntakeDto } from './dto/create-layer-hen-intake.dto';
import { CreateEggProductionDto } from './dto/create-egg-production.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateMortalityDto } from './dto/create-mortality.dto';
import { CreatePulletIntakeDto } from './dto/create-pullet-intake.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

type AuthUser = { sub: string; role: UserRole };

/** Vente d’œufs au carton : une tablette = ce nombre d’œufs déduit du stock. */
const EGGS_PER_TABLETTE = 30;

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
  ) {}

  async addPulletIntake(user: AuthUser, dto: CreatePulletIntakeDto) {
    await this.roomsService.assertManagerRoomAccess(user, dto.roomId, RoomType.PULLET);
    return this.prisma.$transaction(async (tx) => {
      const unitDec = new Prisma.Decimal(dto.unitCost);
      const intake = await tx.pulletIntake.create({
        data: {
          roomId: dto.roomId,
          date: new Date(dto.date),
          quantity: dto.quantity,
          unitCost: unitDec,
          notes: dto.notes,
        },
      });
      await tx.stockMovement.create({
        data: {
          roomId: dto.roomId,
          occurredAt: new Date(dto.date),
          itemType: StockItemType.PULLET,
          direction: StockDirection.IN,
          quantity: dto.quantity,
          reason: StockMovementReason.PURCHASE,
          refId: intake.id,
          notes: dto.notes,
        },
      });
      const totalExpense = unitDec.mul(dto.quantity);
      if (totalExpense.gt(0)) {
        const note = dto.notes?.trim();
        const pulletWord = dto.quantity === 1 ? 'poulette' : 'poulettes';
        const detail = `${dto.quantity} × ${unitDec.toString()} FCFA/tête`;
        const baseDesc = `Appro de ${dto.quantity} ${pulletWord} (${detail})`;
        await tx.expense.create({
          data: {
            roomId: dto.roomId,
            date: new Date(dto.date),
            category: ExpenseCategory.APPROVISIONNEMENT,
            amount: totalExpense,
            description: note ? `${baseDesc} — ${note}` : baseDesc,
          },
        });
      }
      return intake;
    });
  }

  async addLayerHenIntake(user: AuthUser, dto: CreateLayerHenIntakeDto) {
    await this.roomsService.assertManagerRoomAccess(user, dto.roomId, RoomType.LAYER);
    return this.prisma.$transaction(async (tx) => {
      const unitDec = new Prisma.Decimal(dto.unitCost);
      const intake = await tx.layerHenIntake.create({
        data: {
          roomId: dto.roomId,
          date: new Date(dto.date),
          quantity: dto.quantity,
          unitCost: unitDec,
          notes: dto.notes,
        },
      });
      await tx.stockMovement.create({
        data: {
          roomId: dto.roomId,
          occurredAt: new Date(dto.date),
          itemType: StockItemType.LAYER_HEN,
          direction: StockDirection.IN,
          quantity: dto.quantity,
          reason: StockMovementReason.PURCHASE,
          refId: intake.id,
          notes: dto.notes,
        },
      });
      const totalExpense = unitDec.mul(dto.quantity);
      if (totalExpense.gt(0)) {
        const note = dto.notes?.trim();
        const henWord = dto.quantity === 1 ? 'pondeuse' : 'pondeuses';
        const detail = `${dto.quantity} × ${unitDec.toString()} FCFA/tête`;
        const baseDesc = `Appro de ${dto.quantity} ${henWord} (${detail})`;
        await tx.expense.create({
          data: {
            roomId: dto.roomId,
            date: new Date(dto.date),
            category: ExpenseCategory.APPROVISIONNEMENT,
            amount: totalExpense,
            description: note ? `${baseDesc} — ${note}` : baseDesc,
          },
        });
      }
      return intake;
    });
  }

  async addEggProduction(user: AuthUser, dto: CreateEggProductionDto) {
    await this.roomsService.assertManagerRoomAccess(user, dto.roomId, RoomType.LAYER);
    return this.prisma.$transaction(async (tx) => {
      const production = await tx.eggProduction.create({
        data: {
          roomId: dto.roomId,
          date: new Date(dto.date),
          quantity: dto.quantity,
          notes: dto.notes,
        },
      });
      await tx.stockMovement.create({
        data: {
          roomId: dto.roomId,
          occurredAt: new Date(dto.date),
          itemType: StockItemType.EGG,
          direction: StockDirection.IN,
          quantity: dto.quantity,
          reason: StockMovementReason.PRODUCTION,
          refId: production.id,
          notes: dto.notes,
        },
      });
      return production;
    });
  }

  async addMortality(user: AuthUser, dto: CreateMortalityDto) {
    await this.roomsService.assertManagerRoomAccess(user, dto.roomId);
    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
      select: { type: true },
    });
    if (!room) {
      throw new BadRequestException('Salle introuvable');
    }
    const itemType =
      room.type === RoomType.LAYER ? StockItemType.LAYER_HEN : StockItemType.PULLET;
    await this.assertStockAvailable(dto.roomId, itemType, dto.quantity);
    return this.prisma.$transaction(async (tx) => {
      const mortality = await tx.mortality.create({
        data: {
          roomId: dto.roomId,
          date: new Date(dto.date),
          quantity: dto.quantity,
          cause: dto.cause,
        },
      });
      await tx.stockMovement.create({
        data: {
          roomId: dto.roomId,
          occurredAt: new Date(dto.date),
          itemType,
          direction: StockDirection.OUT,
          quantity: dto.quantity,
          reason: StockMovementReason.MORTALITY,
          refId: mortality.id,
          notes: dto.cause,
        },
      });
      return mortality;
    });
  }

  async addExpense(user: AuthUser, dto: CreateExpenseDto) {
    if (dto.roomId) {
      await this.roomsService.assertManagerRoomAccess(user, dto.roomId);
    } else if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Le gérant doit lier la dépense à une salle');
    }
    return this.prisma.expense.create({
      data: {
        roomId: dto.roomId,
        date: new Date(dto.date),
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
      },
    });
  }

  async addSale(user: AuthUser, dto: CreateSaleDto) {
    const room = await this.roomsService.assertManagerRoomAccess(user, dto.roomId);
    if (room.type === RoomType.PULLET && dto.itemType !== SaleItemType.PULLET) {
      throw new BadRequestException('Une salle poulettes ne vend que des poulettes');
    }
    if (room.type === RoomType.LAYER && dto.itemType === SaleItemType.PULLET) {
      throw new BadRequestException('Une salle pondeuses ne vend pas de poulettes');
    }

    let stockItemType: StockItemType;
    switch (dto.itemType) {
      case SaleItemType.PULLET:
        stockItemType = StockItemType.PULLET;
        break;
      case SaleItemType.LAYER_HEN:
        stockItemType = StockItemType.LAYER_HEN;
        break;
      case SaleItemType.EGG:
        stockItemType = StockItemType.EGG;
        break;
    }
    let stockOutQty = dto.quantity;
    if (dto.itemType === SaleItemType.EGG) {
      stockOutQty = dto.quantity * EGGS_PER_TABLETTE;
    }
    await this.assertStockAvailable(dto.roomId, stockItemType, stockOutQty);
    const total = dto.unitPrice * dto.quantity;
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          roomId: dto.roomId,
          date: new Date(dto.date),
          customerName: dto.customerName,
          itemType: dto.itemType,
          quantity: dto.quantity,
          unitPrice: dto.unitPrice,
          total,
          notes: dto.notes,
        },
      });
      await tx.stockMovement.create({
        data: {
          roomId: dto.roomId,
          occurredAt: new Date(dto.date),
          itemType: stockItemType,
          direction: StockDirection.OUT,
          quantity: stockOutQty,
          reason: StockMovementReason.SALE,
          refId: sale.id,
          notes: dto.notes,
        },
      });
      return sale;
    });
  }

  async addStockMovement(user: AuthUser, dto: CreateStockMovementDto) {
    const room = await this.roomsService.assertManagerRoomAccess(user, dto.roomId);
    this.assertStockCompatibility(room.type, dto.itemType);
    if (dto.direction === StockDirection.OUT) {
      await this.assertStockAvailable(dto.roomId, dto.itemType, dto.quantity);
    }
    return this.prisma.stockMovement.create({
      data: {
        roomId: dto.roomId,
        occurredAt: new Date(dto.date),
        itemType: dto.itemType,
        direction: dto.direction,
        quantity: dto.quantity,
        reason: dto.reason,
        notes: dto.notes,
      },
    });
  }

  async listRecentByRoom(user: AuthUser, roomId: string) {
    await this.roomsService.assertManagerRoomAccess(user, roomId);
    const [eggProductions, layerHenIntakes, mortalities, expenses, sales] =
      await Promise.all([
        this.prisma.eggProduction.findMany({
          where: { roomId },
          take: 10,
          orderBy: { date: 'desc' },
        }),
        this.prisma.layerHenIntake.findMany({
          where: { roomId },
          take: 10,
          orderBy: { date: 'desc' },
        }),
        this.prisma.mortality.findMany({
          where: { roomId },
          take: 10,
          orderBy: { date: 'desc' },
        }),
        this.prisma.expense.findMany({
          where: { roomId },
          take: 10,
          orderBy: { date: 'desc' },
        }),
        this.prisma.sale.findMany({
          where: { roomId },
          take: 10,
          orderBy: { date: 'desc' },
        }),
      ]);
    return { eggProductions, layerHenIntakes, mortalities, expenses, sales };
  }

  async summaryByRoom(
    user: AuthUser,
    roomId: string,
    range: StatsDateRangeFilter | null,
  ) {
    const room = await this.roomsService.assertManagerRoomAccess(user, roomId);
    const dateBand = range
      ? { date: { gte: range.from, lte: range.toDay } }
      : {};
    const stockWhere = range
      ? {
          roomId,
          occurredAt: { lte: range.toEndInclusive },
        }
      : { roomId };

    const [sales, expenses, mortality, eggProduction, pulletIntake, layerHenIntake, stockMoves] =
      await Promise.all([
        this.prisma.sale.aggregate({
          where: { roomId, ...dateBand },
          _sum: { total: true, quantity: true },
        }),
        this.prisma.expense.aggregate({
          where: { roomId, ...dateBand },
          _sum: { amount: true },
        }),
        this.prisma.mortality.aggregate({
          where: { roomId, ...dateBand },
          _sum: { quantity: true },
        }),
        this.prisma.eggProduction.aggregate({
          where: { roomId, ...dateBand },
          _sum: { quantity: true },
        }),
        this.prisma.pulletIntake.aggregate({
          where: { roomId, ...dateBand },
          _sum: { quantity: true },
        }),
        this.prisma.layerHenIntake.aggregate({
          where: { roomId, ...dateBand },
          _sum: { quantity: true },
        }),
        this.prisma.stockMovement.findMany({
          where: stockWhere,
          select: { direction: true, quantity: true, itemType: true },
        }),
      ]);

    const stockByItem = stockMoves.reduce<Record<string, number>>((acc, move) => {
      const sign = move.direction === StockDirection.IN ? 1 : -1;
      acc[move.itemType] = (acc[move.itemType] ?? 0) + sign * move.quantity;
      return acc;
    }, {});

    const revenues = Number(sales._sum.total ?? 0);
    const costs = Number(expenses._sum.amount ?? 0);
    return {
      room: { id: room.id, name: room.name, type: room.type, capacity: room.capacity },
      revenues,
      costs,
      profit: revenues - costs,
      salesQty: Number(sales._sum.quantity ?? 0),
      mortalityQty: Number(mortality._sum.quantity ?? 0),
      eggQty: Number(eggProduction._sum.quantity ?? 0),
      pulletIntakeQty: Number(pulletIntake._sum.quantity ?? 0),
      layerHenIntakeQty: Number(layerHenIntake._sum.quantity ?? 0),
      stockByItem,
      statsPeriod: range ? statsPeriodPayload(range) : null,
    };
  }

  async listSales(user: AuthUser, roomId: string) {
    await this.roomsService.assertManagerRoomAccess(user, roomId);
    return this.prisma.sale.findMany({
      where: { roomId },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        customerName: true,
        itemType: true,
        quantity: true,
        unitPrice: true,
        total: true,
        notes: true,
      },
    });
  }

  private assertStockCompatibility(roomType: RoomType, itemType: StockItemType) {
    if (roomType === RoomType.PULLET) {
      if (
        itemType === StockItemType.EGG ||
        itemType === StockItemType.LAYER_HEN
      ) {
        throw new BadRequestException(
          'Stock œuf ou pondeuse interdit en salle poulettes',
        );
      }
    }
    if (roomType === RoomType.LAYER && itemType === StockItemType.PULLET) {
      throw new BadRequestException('Stock poulette interdit en salle pondeuses');
    }
  }

  private async assertStockAvailable(
    roomId: string,
    itemType: StockItemType,
    requestedQty: number,
  ) {
    const moves = await this.prisma.stockMovement.findMany({
      where: { roomId, itemType },
      select: { direction: true, quantity: true },
    });
    const currentStock = moves.reduce((acc, move) => {
      return acc + (move.direction === StockDirection.IN ? move.quantity : -move.quantity);
    }, 0);
    if (requestedQty > currentStock) {
      throw new BadRequestException(
        `Stock insuffisant (${itemType}) : disponible ${currentStock}, demandé ${requestedQty}`,
      );
    }
  }
}
