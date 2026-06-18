import { Injectable } from '@nestjs/common';
import { StockItemType, UserRole } from '@prisma/client';
import {
  parseStatsDateRange,
  statsPeriodPayload,
} from '../common/stats-date-range';
import {
  aggregateGlobalFeedStock,
  feedTypesBelowThreshold,
  FEED_STOCK_ALERT_THRESHOLD,
} from '../common/global-feed-stock';
import { PrismaService } from '../prisma/prisma.service';

type AuthUser = { sub: string; role: UserRole };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthUser, fromStr?: string, toStr?: string) {
    const range = parseStatsDateRange(fromStr, toStr);
    const dateBand = range
      ? { date: { gte: range.from, lte: range.toDay } }
      : {};

    const roomFilter =
      user.role === UserRole.ADMIN ? {} : { room: { managerId: user.sub } };

    const expenseWhere =
      user.role === UserRole.ADMIN
        ? range
          ? { date: { gte: range.from, lte: range.toDay } }
          : {}
        : {
            roomId: { not: null },
            ...roomFilter,
            ...dateBand,
          };

    const nestedRoomWhere = {
      ...roomFilter,
      ...dateBand,
    };

    const [expensesAgg, salesAgg, mortalityAgg, eggsAgg, pulletsAgg, layerHensAgg, roomCount, feedMoves] =
      await Promise.all([
        this.prisma.expense.aggregate({
          where: expenseWhere,
          _sum: { amount: true },
        }),
        this.prisma.sale.aggregate({
          where: nestedRoomWhere,
          _sum: { total: true },
        }),
        this.prisma.mortality.aggregate({
          where: nestedRoomWhere,
          _sum: { quantity: true },
        }),
        this.prisma.eggProduction.aggregate({
          where: nestedRoomWhere,
          _sum: { quantity: true },
        }),
        this.prisma.pulletIntake.aggregate({
          where: nestedRoomWhere,
          _sum: { quantity: true },
        }),
        this.prisma.layerHenIntake.aggregate({
          where: nestedRoomWhere,
          _sum: { quantity: true },
        }),
        this.prisma.room.count({
          where: user.role === UserRole.ADMIN ? {} : { managerId: user.sub },
        }),
        user.role === UserRole.ADMIN
          ? this.prisma.stockMovement.findMany({
              where: { itemType: StockItemType.FEED, roomId: null },
              select: { direction: true, quantity: true, feedType: true },
            })
          : Promise.resolve([]),
      ]);

    const revenues = Number(salesAgg._sum.total ?? 0);
    const expenses = Number(expensesAgg._sum.amount ?? 0);
    const stockByFeedType =
      user.role === UserRole.ADMIN ? aggregateGlobalFeedStock(feedMoves) : undefined;
    const feedStockAlerts =
      user.role === UserRole.ADMIN && stockByFeedType
        ? feedTypesBelowThreshold(stockByFeedType, FEED_STOCK_ALERT_THRESHOLD)
        : undefined;

    return {
      rooms: roomCount,
      revenues,
      expenses,
      profit: revenues - expenses,
      mortality: Number(mortalityAgg._sum.quantity ?? 0),
      eggProduction: Number(eggsAgg._sum.quantity ?? 0),
      pulletIntake: Number(pulletsAgg._sum.quantity ?? 0),
      layerHenIntake: Number(layerHensAgg._sum.quantity ?? 0),
      stockByFeedType,
      feedStockAlerts,
      feedStockAlertThreshold: user.role === UserRole.ADMIN ? FEED_STOCK_ALERT_THRESHOLD : undefined,
      statsPeriod: range ? statsPeriodPayload(range) : null,
    };
  }
}
