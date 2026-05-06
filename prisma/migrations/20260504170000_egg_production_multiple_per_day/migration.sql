-- Permettre plusieurs enregistrements de production d'œufs le même jour pour une même salle
DROP INDEX IF EXISTS "EggProduction_roomId_date_key";

CREATE INDEX IF NOT EXISTS "EggProduction_roomId_date_idx" ON "EggProduction"("roomId", "date");
