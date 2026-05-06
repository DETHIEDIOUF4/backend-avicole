import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateSalesPricingDto } from './dto/update-sales-pricing.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('sales-pricing')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getSalesPricing() {
    return this.settingsService.getSalesPricing();
  }

  @Patch('sales-pricing')
  @Roles(UserRole.ADMIN)
  updateSalesPricing(@Body() dto: UpdateSalesPricingDto) {
    return this.settingsService.updateSalesPricing(dto);
  }
}
