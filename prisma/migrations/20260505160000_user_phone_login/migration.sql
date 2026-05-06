-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Backfill existing users with unique placeholder phones.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
  FROM "User"
)
UPDATE "User" u
SET "phone" = '700000' || LPAD(numbered.rn::text, 4, '0')
FROM numbered
WHERE u."id" = numbered."id";

-- Enforce constraints
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
