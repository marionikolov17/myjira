-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('Pending', 'Active');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "activation_token_expires_at" TIMESTAMPTZ,
ADD COLUMN     "activation_token_hash" TEXT,
ADD COLUMN     "status" "user_status" NOT NULL DEFAULT 'Pending',
ALTER COLUMN "password" DROP NOT NULL;

-- Backfill existing (pre-activation) users so they remain able to log in.
-- Every row that exists at migration time predates the activation flow and has
-- a usable password, so it is considered already Active. New inserts continue
-- to default to 'Pending'.
UPDATE "users" SET "status" = 'Active';

-- CreateIndex
CREATE INDEX "users_activation_token_hash_idx" ON "users"("activation_token_hash");
