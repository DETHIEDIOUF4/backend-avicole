-- Stock aliment global : mouvements FEED sans salle (roomId nullable)
ALTER TABLE "StockMovement" ALTER COLUMN "roomId" DROP NOT NULL;

CREATE INDEX "StockMovement_itemType_feedType_idx"
  ON "StockMovement"("itemType", "feedType");
