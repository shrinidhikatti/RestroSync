-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "enabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
