-- CreateTable
CREATE TABLE "SalesPricingConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "eggUnitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pulletUnitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesPricingConfig_pkey" PRIMARY KEY ("id")
);
