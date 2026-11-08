-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "body" TEXT NOT NULL,
    "issue_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_issue_id_idx" ON "comments"("issue_id");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
