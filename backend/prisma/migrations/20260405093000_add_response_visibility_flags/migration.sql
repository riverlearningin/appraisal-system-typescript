-- Add visibility toggles for manager and management responses in each cycle
ALTER TABLE "Cycle"
ADD COLUMN "showManagerResponses" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showManagementResponses" BOOLEAN NOT NULL DEFAULT true;
