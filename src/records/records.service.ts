import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  ExpenseCategory,
  FeedType,
  Prisma,
  RoomType,
  SaleItemType,
  StockDirection,
  StockItemType,
  StockMovementReason,
  UserRole,
} from '@prisma/client';
import { statsPeriodPayload, type StatsDateRangeFilter } from '../common/stats-date-range';
import { feedTypeLabel } from '../common/feed-type-labels';
import { aggregateGlobalFeedStock } from '../common/global-feed-stock';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { SettingsService } from '../settings/settings.service';
import { CreateLayerHenIntakeDto } from './dto/create-layer-hen-intake.dto';
import { CreateEggProductionDto } from './dto/create-egg-production.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateFeedConsumptionDto } from './dto/create-feed-consumption.dto';
import { CreateMortalityDto } from './dto/create-mortality.dto';
import { CreatePulletIntakeDto } from './dto/create-pullet-intake.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import {
  buildExpensesReportPdf,
  expensesReportFilename,
} from './expenses-report-pdf';
import {
  buildVaccinationReportPdf,
  vaccinationReportFilename,
} from './vaccination-report-pdf';

type AuthUser = { sub: string; role: UserRole };

/** Vente d’œufs au carton : une tablette = ce nombre d’œufs déduit du stock. */
const EGGS_PER_TABLETTE = 30;

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly settingsService: SettingsService,
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
    if (dto.category === ExpenseCategory.FEED) {
      if (user.role !== UserRole.ADMIN) {
        throw new BadRequestException(
          'Seul l’administrateur peut enregistrer un achat d’aliment (stock global)',
        );
      }
      if (dto.roomId) {
        throw new BadRequestException(
          'Le stock aliment est global : n’associez pas l’achat à une salle',
        );
      }
      if (!dto.feedType) {
        throw new BadRequestException('Indiquez le type de sac d’aliment');
      }
      if (!dto.feedQuantity || dto.feedQuantity < 1) {
        throw new BadRequestException('Indiquez le nombre de sacs achetés (au moins 1)');
      }
    } else if (dto.roomId) {
      await this.roomsService.assertManagerRoomAccess(user, dto.roomId);
    } else if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Le gérant doit lier la dépense à une salle');
    }

    const sacWord = dto.feedQuantity === 1 ? 'sac' : 'sacs';
    const feedDescBase =
      dto.category === ExpenseCategory.FEED && dto.feedType && dto.feedQuantity
        ? `Achat aliment ${feedTypeLabel(dto.feedType)} (${dto.feedQuantity} ${sacWord})`
        : null;
    const description =
      dto.description?.trim() && feedDescBase
        ? `${feedDescBase} — ${dto.description.trim()}`
        : dto.description?.trim() || feedDescBase || undefined;

    if (dto.category === ExpenseCategory.FEED && dto.feedType && dto.feedQuantity) {
      const feedQuantity = dto.feedQuantity;
      const feedType = dto.feedType;
      return this.prisma.$transaction(async (tx) => {
        const expense = await tx.expense.create({
          data: {
            roomId: null,
            date: new Date(dto.date),
            category: dto.category,
            amount: dto.amount,
            description,
            feedType,
            feedQuantity,
          },
        });
        await tx.stockMovement.create({
          data: {
            roomId: null,
            occurredAt: new Date(dto.date),
            itemType: StockItemType.FEED,
            feedType,
            direction: StockDirection.IN,
            quantity: feedQuantity,
            reason: StockMovementReason.PURCHASE,
            refId: expense.id,
            notes: description,
          },
        });
        return expense;
      });
    }

    return this.prisma.expense.create({
      data: {
        roomId: dto.roomId,
        date: new Date(dto.date),
        category: dto.category,
        amount: dto.amount,
        description,
      },
    });
  }

  async addFeedConsumption(user: AuthUser, dto: CreateFeedConsumptionDto) {
    const room = await this.roomsService.assertManagerRoomAccess(user, dto.roomId);
    await this.assertGlobalFeedStockAvailable(dto.feedType, dto.quantity);
    const noteParts = [`Consommation salle ${room.name}`];
    if (dto.notes?.trim()) {
      noteParts.push(dto.notes.trim());
    }
    const notes = noteParts.join(' — ');
    return this.prisma.stockMovement.create({
      data: {
        roomId: null,
        occurredAt: new Date(dto.date),
        itemType: StockItemType.FEED,
        feedType: dto.feedType,
        direction: StockDirection.OUT,
        quantity: dto.quantity,
        reason: StockMovementReason.FEED_CONSUMPTION,
        refId: dto.roomId,
        notes,
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

    const unitPrice = await this.resolveSaleUnitPrice(user, dto);

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
    const total = unitPrice * dto.quantity;
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          roomId: dto.roomId,
          date: new Date(dto.date),
          customerName: dto.customerName,
          itemType: dto.itemType,
          quantity: dto.quantity,
          unitPrice,
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
    if (dto.itemType === StockItemType.FEED) {
      throw new BadRequestException(
        'Le stock aliment se gère via une dépense aliment (admin, stock global)',
      );
    }
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
    const limitRecent = user.role !== UserRole.MANAGER;
    const [eggProductions, layerHenIntakes, mortalities, expenses, sales, feedConsumptions, feedConsumptionTotalsRaw] =
      await Promise.all([
        this.prisma.eggProduction.findMany({
          where: { roomId },
          orderBy: { date: 'desc' },
          ...(limitRecent ? { take: 10 } : {}),
        }),
        this.prisma.layerHenIntake.findMany({
          where: { roomId },
          orderBy: { date: 'desc' },
          ...(limitRecent ? { take: 10 } : {}),
        }),
        this.prisma.mortality.findMany({
          where: { roomId },
          orderBy: { date: 'desc' },
          ...(limitRecent ? { take: 10 } : {}),
        }),
        this.prisma.expense.findMany({
          where: { roomId },
          orderBy: { date: 'desc' },
          ...(limitRecent ? { take: 10 } : {}),
        }),
        this.prisma.sale.findMany({
          where: { roomId },
          orderBy: { date: 'desc' },
          ...(limitRecent ? { take: 10 } : {}),
          select: {
            id: true,
            date: true,
            customerName: true,
            itemType: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        }),
        this.prisma.stockMovement.findMany({
          where: {
            reason: StockMovementReason.FEED_CONSUMPTION,
            refId: roomId,
          },
          orderBy: { occurredAt: 'desc' },
          ...(limitRecent ? { take: 10 } : {}),
          select: {
            id: true,
            occurredAt: true,
            feedType: true,
            quantity: true,
            notes: true,
          },
        }),
        this.prisma.stockMovement.groupBy({
          by: ['feedType'],
          where: {
            reason: StockMovementReason.FEED_CONSUMPTION,
            refId: roomId,
          },
          _sum: { quantity: true },
        }),
      ]);
    const feedConsumptionTotals = feedConsumptionTotalsRaw
      .filter((row) => row.feedType != null)
      .map((row) => ({
        feedType: row.feedType!,
        quantity: row._sum.quantity ?? 0,
      }));
    return {
      eggProductions,
      layerHenIntakes,
      mortalities,
      expenses,
      sales,
      feedConsumptions: feedConsumptions.map((row) => ({
        id: row.id,
        date: row.occurredAt.toISOString().slice(0, 10),
        feedType: row.feedType,
        quantity: row.quantity,
        notes: row.notes,
      })),
      feedConsumptionTotals,
    };
  }

  async summaryByRoom(
    user: AuthUser,
    roomId: string,
    range: StatsDateRangeFilter | null,
  ) {
    const room = await this.roomsService.assertManagerRoomAccess(user, roomId);
    const effectiveRange = user.role === UserRole.MANAGER ? null : range;
    const dateBand = effectiveRange
      ? { date: { gte: effectiveRange.from, lte: effectiveRange.toDay } }
      : {};
    const stockWhere = effectiveRange
      ? {
          roomId,
          occurredAt: { lte: effectiveRange.toEndInclusive },
        }
      : { roomId };

    const [sales, salesByItem, expenses, mortality, eggProduction, pulletIntake, layerHenIntake, stockMoves] =
      await Promise.all([
        this.prisma.sale.aggregate({
          where: { roomId, ...dateBand },
          _sum: { total: true },
        }),
        this.prisma.sale.groupBy({
          by: ['itemType'],
          where: { roomId, ...dateBand },
          _sum: { quantity: true },
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
      if (move.itemType === StockItemType.FEED) {
        return acc;
      }
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
      salesQty: this.sumSaleQuantityInUnits(salesByItem),
      mortalityQty: Number(mortality._sum.quantity ?? 0),
      eggQty: Number(eggProduction._sum.quantity ?? 0),
      pulletIntakeQty: Number(pulletIntake._sum.quantity ?? 0),
      layerHenIntakeQty: Number(layerHenIntake._sum.quantity ?? 0),
      stockByItem,
      statsPeriod: effectiveRange ? statsPeriodPayload(effectiveRange) : null,
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

  async listFeedPurchases(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Historique achats aliment réservé à l’administrateur');
    }
    return this.prisma.expense.findMany({
      where: {
        category: ExpenseCategory.FEED,
        roomId: null,
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        feedType: true,
        feedQuantity: true,
        amount: true,
        description: true,
      },
    });
  }

  async getVaccinationReportPdf(user: AuthUser, roomId: string) {
    const room = await this.roomsService.assertManagerRoomAccess(user, roomId);
    const expenses = await this.prisma.expense.findMany({
      where: { roomId, category: ExpenseCategory.VACCINE },
      orderBy: { date: 'asc' },
    });
    const roomTypeLabel = room.type === RoomType.PULLET ? 'Poulettes' : 'Pondeuses';
    const buffer = await buildVaccinationReportPdf({
      farmName: 'Ferme Keur Guilaye',
      roomName: room.name,
      roomTypeLabel,
      rows: expenses.map((row) => ({
        date: row.date,
        description: row.description?.trim() || 'Vaccination',
      })),
    });
    return {
      buffer,
      filename: vaccinationReportFilename(room.name),
    };
  }

  async getExpensesReportPdf(user: AuthUser, roomId: string) {
    const room = await this.roomsService.assertManagerRoomAccess(user, roomId);
    const expenses = await this.prisma.expense.findMany({
      where: { roomId },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        category: true,
        amount: true,
        description: true,
        feedType: true,
        feedQuantity: true,
      },
    });
    const roomTypeLabel = room.type === RoomType.PULLET ? 'Poulettes' : 'Pondeuses';
    const buffer = await buildExpensesReportPdf({
      farmName: 'Ferme Keur Guilaye',
      roomName: room.name,
      roomTypeLabel,
      rows: expenses.map((row) => ({
        date: row.date,
        category: row.category,
        amount: Number(row.amount),
        description: row.description,
        feedType: row.feedType,
        feedQuantity: row.feedQuantity,
      })),
    });
    return {
      buffer,
      filename: expensesReportFilename(room.name),
    };
  }

  private sumSaleQuantityInUnits(
    rows: Array<{ itemType: SaleItemType; _sum: { quantity: number | null } }>,
  ): number {
    return rows.reduce((sum, row) => {
      const qty = Number(row._sum.quantity ?? 0);
      if (row.itemType === SaleItemType.EGG) {
        return sum + qty * EGGS_PER_TABLETTE;
      }
      return sum + qty;
    }, 0);
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

  private async resolveSaleUnitPrice(
    user: AuthUser,
    dto: CreateSaleDto,
  ): Promise<number> {
    if (user.role === UserRole.MANAGER) {
      const pricing = await this.settingsService.getSalesPricing();
      switch (dto.itemType) {
        case SaleItemType.PULLET:
          return pricing.pulletUnitPrice;
        case SaleItemType.EGG:
          return pricing.eggUnitPrice;
        case SaleItemType.LAYER_HEN:
          return pricing.layerHenUnitPrice;
      }
    }
    if (dto.unitPrice == null || !Number.isFinite(dto.unitPrice) || dto.unitPrice < 0) {
      throw new BadRequestException('Indiquez un prix unitaire de vente valide');
    }
    return dto.unitPrice;
  }

  private async assertGlobalFeedStockAvailable(
    feedType: FeedType,
    requestedQty: number,
  ) {
    const moves = await this.prisma.stockMovement.findMany({
      where: { itemType: StockItemType.FEED, roomId: null },
      select: { direction: true, quantity: true, feedType: true },
    });
    const stockByFeedType = aggregateGlobalFeedStock(moves);
    const currentStock = stockByFeedType[feedType] ?? 0;
    if (requestedQty > currentStock) {
      throw new BadRequestException(
        `Stock aliment insuffisant (${feedTypeLabel(feedType)} : disponible ${currentStock}, demandé ${requestedQty})`,
      );
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
