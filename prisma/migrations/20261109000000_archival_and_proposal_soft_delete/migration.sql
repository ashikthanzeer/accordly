-- Additive, non-destructive migration for Project Archival and Proposal Soft Deletion
-- Ensures compatibility with PostgreSQL in NeonDB without data loss

-- 1. Add project archival tracking columns
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "archivedBy" TEXT;

-- 2. Add proposal soft deletion tracking columns
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

-- 3. Add performance indexes for active workspace queries
CREATE INDEX IF NOT EXISTS "Project_status_idx" ON "Project"("status");
CREATE INDEX IF NOT EXISTS "Project_archivedAt_idx" ON "Project"("archivedAt");
CREATE INDEX IF NOT EXISTS "ChangeOrder_deletedAt_idx" ON "ChangeOrder"("deletedAt");

