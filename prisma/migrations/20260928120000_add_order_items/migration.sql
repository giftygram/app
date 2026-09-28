-- One row per product on an order. Orders created before this migration
-- have none, and every screen falls back to Order.bouquetName /
-- Order.referenceImageUrl for them, so this is purely additive.
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "shopifyProductId" TEXT,
    "referenceImageUrl" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderItem_orderId_position_key" ON "OrderItem"("orderId", "position");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Which line a bouquet photo is of. Nullable: delivery photos have no line,
-- and bouquet photos taken before this migration predate line items.
ALTER TABLE "Photo" ADD COLUMN "orderItemId" TEXT;

CREATE INDEX "Photo_orderItemId_idx" ON "Photo"("orderItemId");

ALTER TABLE "Photo" ADD CONSTRAINT "Photo_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
