-- CreateIndex
CREATE INDEX "Adjustment_locationId_idx" ON "Adjustment"("locationId");

-- CreateIndex
CREATE INDEX "AdjustmentLine_adjustmentId_idx" ON "AdjustmentLine"("adjustmentId");

-- CreateIndex
CREATE INDEX "AdjustmentLine_productId_idx" ON "AdjustmentLine"("productId");

-- CreateIndex
CREATE INDEX "Delivery_partnerId_idx" ON "Delivery"("partnerId");

-- CreateIndex
CREATE INDEX "DeliveryLine_deliveryId_idx" ON "DeliveryLine"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryLine_productId_idx" ON "DeliveryLine"("productId");

-- CreateIndex
CREATE INDEX "Receipt_partnerId_idx" ON "Receipt"("partnerId");

-- CreateIndex
CREATE INDEX "ReceiptLine_receiptId_idx" ON "ReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "ReceiptLine_productId_idx" ON "ReceiptLine"("productId");

-- CreateIndex
CREATE INDEX "TransferLine_transferId_idx" ON "TransferLine"("transferId");

-- CreateIndex
CREATE INDEX "TransferLine_productId_idx" ON "TransferLine"("productId");

-- CreateIndex
CREATE INDEX "TransferLine_fromLocationId_idx" ON "TransferLine"("fromLocationId");

-- CreateIndex
CREATE INDEX "TransferLine_toLocationId_idx" ON "TransferLine"("toLocationId");

-- CHECK constraints — enforce ledger integrity at the DB level (defense in depth;
-- mirrors the guards in StockService.postMove()). Prisma does not model CHECK
-- constraints, so they live here as raw SQL (like the stock_quant view) and are
-- not drift-checked.
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_has_location"
  CHECK ("fromLocationId" IS NOT NULL OR "toLocationId" IS NOT NULL);
