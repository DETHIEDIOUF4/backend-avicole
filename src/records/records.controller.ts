import { Body, Controller, Get, Param, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { parseStatsDateRange } from '../common/stats-date-range';
import { CreateEggProductionDto } from './dto/create-egg-production.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateLayerHenIntakeDto } from './dto/create-layer-hen-intake.dto';
import { CreateMortalityDto } from './dto/create-mortality.dto';
import { CreatePulletIntakeDto } from './dto/create-pullet-intake.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateFeedConsumptionDto } from './dto/create-feed-consumption.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { RecordsService } from './records.service';

@Controller('records')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post('pullet-intakes')
  addPulletIntake(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: CreatePulletIntakeDto,
  ) {
    return this.recordsService.addPulletIntake(user, dto);
  }

  @Post('egg-productions')
  addEggProduction(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: CreateEggProductionDto,
  ) {
    return this.recordsService.addEggProduction(user, dto);
  }

  @Post('layer-hen-intakes')
  addLayerHenIntake(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: CreateLayerHenIntakeDto,
  ) {
    return this.recordsService.addLayerHenIntake(user, dto);
  }

  @Post('mortalities')
  addMortality(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: CreateMortalityDto,
  ) {
    return this.recordsService.addMortality(user, dto);
  }

  @Post('expenses')
  addExpense(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: CreateExpenseDto,
  ) {
    return this.recordsService.addExpense(user, dto);
  }

  @Post('sales')
  addSale(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: CreateSaleDto,
  ) {
    return this.recordsService.addSale(user, dto);
  }

  @Post('feed-consumptions')
  addFeedConsumption(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: CreateFeedConsumptionDto,
  ) {
    return this.recordsService.addFeedConsumption(user, dto);
  }

  @Post('stock-movements')
  addStock(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.recordsService.addStockMovement(user, dto);
  }

  @Get('rooms/:roomId/recent')
  listRecent(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('roomId') roomId: string,
  ) {
    return this.recordsService.listRecentByRoom(user, roomId);
  }

  @Get('rooms/:roomId/summary')
  summaryByRoom(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('roomId') roomId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = parseStatsDateRange(from, to);
    return this.recordsService.summaryByRoom(user, roomId, range);
  }

  @Get('rooms/:roomId/sales')
  salesByRoom(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('roomId') roomId: string,
  ) {
    return this.recordsService.listSales(user, roomId);
  }

  @Get('feed-purchases')
  @Roles(UserRole.ADMIN)
  listFeedPurchases(@CurrentUser() user: { sub: string; role: UserRole }) {
    return this.recordsService.listFeedPurchases(user);
  }

  @Get('rooms/:roomId/vaccination-report')
  async vaccinationReport(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('roomId') roomId: string,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.recordsService.getVaccinationReportPdf(
      user,
      roomId,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('rooms/:roomId/expenses-report')
  async expensesReport(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('roomId') roomId: string,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.recordsService.getExpensesReportPdf(
      user,
      roomId,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
