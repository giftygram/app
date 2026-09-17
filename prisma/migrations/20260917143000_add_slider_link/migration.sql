-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "sliderOrderNumber" TEXT,
ADD COLUMN     "sliderStatus" TEXT,
ADD COLUMN     "sliderSyncError" TEXT,
ADD COLUMN     "sliderSyncedAt" TIMESTAMPTZ(3),
ADD COLUMN     "sliderTrackingUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_sliderOrderNumber_key" ON "Order"("sliderOrderNumber");
