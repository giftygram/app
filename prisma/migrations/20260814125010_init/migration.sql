-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "senderName" TEXT,
    "senderPhone" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryArea" TEXT,
    "deliveryMethod" TEXT,
    "mapsLink" TEXT,
    "cardMessage" TEXT,
    "occasion" TEXT,
    "deadlineAt" TIMESTAMP(3),
    "bouquetName" TEXT,
    "referenceImageUrl" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvalDeadline" TIMESTAMP(3),
    "changeRequestNote" TEXT,
    "floristId" TEXT,
    "driverId" TEXT,
    "externalDriverName" TEXT,
    "externalDriverPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_shopifyOrderId_key" ON "Order"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_floristId_idx" ON "Order"("floristId");

-- CreateIndex
CREATE INDEX "Order_driverId_idx" ON "Order"("driverId");

-- CreateIndex
CREATE INDEX "StatusEvent_orderId_idx" ON "StatusEvent"("orderId");

-- CreateIndex
CREATE INDEX "Photo_orderId_idx" ON "Photo"("orderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_floristId_fkey" FOREIGN KEY ("floristId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
