-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "activeModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
