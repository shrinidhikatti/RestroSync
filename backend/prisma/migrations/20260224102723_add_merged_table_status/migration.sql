-- AlterEnum
ALTER TYPE "TableStatus" ADD VALUE 'MERGED';

-- AlterTable
ALTER TABLE "tables" ADD COLUMN     "mergedIntoTableId" TEXT;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_mergedIntoTableId_fkey" FOREIGN KEY ("mergedIntoTableId") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
