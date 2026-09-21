-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shopifyOrderToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_shopifyOrderToken_key" ON "Order"("shopifyOrderToken");
