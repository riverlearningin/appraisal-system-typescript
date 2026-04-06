-- Dynamic points become employee-scoped (personal to reviewee)
ALTER TABLE "Point"
ADD COLUMN "employeeId" INTEGER;

CREATE INDEX "Point_employeeId_idx" ON "Point"("employeeId");

ALTER TABLE "Point"
ADD CONSTRAINT "Point_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
