import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_ID = 'default';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureConfigRow() {
    const existing = await this.prisma.salesPricingConfig.findUnique({
      where: { id: DEFAULT_ID },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.salesPricingConfig.create({
      data: {
        id: DEFAULT_ID,
        eggUnitPrice: 0,
        pulletUnitPrice: 0,
        layerHenUnitPrice: 0,
      },
    });
  }

  async getSalesPricing() {
    const row = await this.ensureConfigRow();
    return {
      eggUnitPrice: Number(row.eggUnitPrice),
      pulletUnitPrice: Number(row.pulletUnitPrice),
      layerHenUnitPrice: Number(row.layerHenUnitPrice),
      updatedAt: row.updatedAt,
    };
  }

  async updateSalesPricing(dto: {
    eggUnitPrice: number;
    pulletUnitPrice: number;
    layerHenUnitPrice: number;
  }) {
    await this.ensureConfigRow();
    const row = await this.prisma.salesPricingConfig.update({
      where: { id: DEFAULT_ID },
      data: {
        eggUnitPrice: dto.eggUnitPrice,
        pulletUnitPrice: dto.pulletUnitPrice,
        layerHenUnitPrice: dto.layerHenUnitPrice,
      },
    });
    return {
      eggUnitPrice: Number(row.eggUnitPrice),
      pulletUnitPrice: Number(row.pulletUnitPrice),
      layerHenUnitPrice: Number(row.layerHenUnitPrice),
      updatedAt: row.updatedAt,
    };
  }
}
