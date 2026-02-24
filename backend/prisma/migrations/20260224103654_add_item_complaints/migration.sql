-- CreateEnum
CREATE TYPE "ComplaintReason" AS ENUM ('QUALITY', 'WRONG_ITEM', 'FOREIGN_OBJECT', 'COLD', 'QUANTITY', 'OTHER');

-- CreateTable
CREATE TABLE "item_complaints" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "menuItemName" TEXT NOT NULL,
    "reason" "ComplaintReason" NOT NULL,
    "notes" TEXT,
    "reportedBy" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_complaints_restaurantId_createdAt_idx" ON "item_complaints"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "item_complaints_branchId_createdAt_idx" ON "item_complaints"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "item_complaints_menuItemId_createdAt_idx" ON "item_complaints"("menuItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "item_complaints" ADD CONSTRAINT "item_complaints_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_complaints" ADD CONSTRAINT "item_complaints_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_complaints" ADD CONSTRAINT "item_complaints_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_complaints" ADD CONSTRAINT "item_complaints_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
