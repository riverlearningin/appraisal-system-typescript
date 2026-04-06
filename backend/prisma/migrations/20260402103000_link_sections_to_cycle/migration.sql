-- Add cycle reference to sections so sections can be scoped per appraisal cycle
ALTER TABLE "Section"
ADD COLUMN "cycleId" INTEGER;

-- Backfill existing sections to the currently active cycle when available
UPDATE "Section"
SET "cycleId" = (
    SELECT "id"
    FROM "Cycle"
    WHERE "status" = 'active'
    ORDER BY "startDate" DESC
    LIMIT 1
)
WHERE "cycleId" IS NULL;

-- Create index and foreign key for cycle-scoped section lookups
CREATE INDEX "Section_cycleId_idx" ON "Section"("cycleId");

ALTER TABLE "Section"
ADD CONSTRAINT "Section_cycleId_fkey"
FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
