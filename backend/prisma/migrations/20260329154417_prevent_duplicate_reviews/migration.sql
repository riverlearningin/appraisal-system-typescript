/*
  Warnings:

  - A unique constraint covering the columns `[cycleId,employeeId,reviewerId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Review_cycleId_employeeId_reviewerId_key" ON "Review"("cycleId", "employeeId", "reviewerId");
