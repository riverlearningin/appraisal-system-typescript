-- AlterTable
ALTER TABLE "ReviewResponses" ALTER COLUMN "rating" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Review_cycleId_idx" ON "Review"("cycleId");
