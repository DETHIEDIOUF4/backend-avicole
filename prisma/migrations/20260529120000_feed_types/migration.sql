-- Types de sacs d'aliment et stock par type
CREATE TYPE "FeedType" AS ENUM (
  'DEMARRAGE',
  'PREMIER_AGE',
  'DEUXIEME_AGE',
  'PONTE',
  'PIQUE_PONTE'
);

ALTER TABLE "Expense" ADD COLUMN "feedType" "FeedType";
ALTER TABLE "Expense" ADD COLUMN "feedQuantity" INTEGER;

ALTER TABLE "StockMovement" ADD COLUMN "feedType" "FeedType";

CREATE INDEX "StockMovement_roomId_itemType_feedType_idx"
  ON "StockMovement"("roomId", "itemType", "feedType");
