-- AlterEnum
ALTER TYPE "StockItemType" ADD VALUE 'LAYER_HEN';

-- CreateTable
CREATE TABLE "LayerHenIntake" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LayerHenIntake_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LayerHenIntake_roomId_date_idx" ON "LayerHenIntake"("roomId", "date");

ALTER TABLE "LayerHenIntake" ADD CONSTRAINT "LayerHenIntake_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesPricingConfig" ADD COLUMN "layerHenUnitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
