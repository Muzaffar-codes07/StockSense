import { NestFactory } from '@nestjs/core';
import { DocStatus, PartnerType } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { InventoryService } from '../src/inventory/inventory.service';
import { AdjustmentsService } from '../src/operations/adjustments.service';
import { DeliveriesService } from '../src/operations/deliveries.service';
import { ReceiptsService } from '../src/operations/receipts.service';
import { TransfersService } from '../src/operations/transfers.service';
import { PrismaService } from '../src/prisma/prisma.service';

// Demo data on top of prisma/seed.ts. Every document goes through the real
// operation services, so stock only ever comes from validated ledger moves.
// Run on a fresh DB: `npm run db:demo` (reset + base seed + this).
//
// Steel Rods plays the demo flow: receive 100 -> transfer 30 to the rack ->
// deliver 20 from the rack -> 3 kg damaged => 77 on hand (67 Main / 10 Rack).

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d: number, hour = 10) => {
  const t = new Date(Date.now() - d * DAY);
  t.setHours(hour, 0, 0, 0);
  return t;
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const receipts = app.get(ReceiptsService);
  const deliveries = app.get(DeliveriesService);
  const transfers = app.get(TransfersService);
  const adjustments = app.get(AdjustmentsService);
  const inventory = app.get(InventoryService);

  try {
    if ((await prisma.stockMove.count()) > 0) {
      console.log('Demo data skipped: the ledger already has moves. Run `npm run db:demo` for a fresh DB.');
      return;
    }

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@stocksense.dev' } });
    const main = await prisma.location.findFirstOrThrow({ where: { name: 'Main Store' } });
    const rack = await prisma.location.findFirstOrThrow({ where: { name: 'Production Rack' } });
    const supplier = await prisma.partner.findFirstOrThrow({ where: { type: PartnerType.SUPPLIER } });
    const customer = await prisma.partner.findFirstOrThrow({ where: { type: PartnerType.CUSTOMER } });
    const raw = await prisma.category.findFirstOrThrow({ where: { name: 'Raw Materials' } });
    const finished = await prisma.category.findFirstOrThrow({ where: { name: 'Finished Goods' } });
    const consumables = await prisma.category.create({ data: { name: 'Consumables' } });
    await prisma.partner.create({ data: { name: 'Northwind Furniture', type: PartnerType.CUSTOMER } });

    const sku = (s: string) => prisma.product.findUniqueOrThrow({ where: { sku: s } });
    const steel = await sku('STEEL-001');
    const chair = await sku('CHAIR-001');
    const product = (name: string, s: string, categoryId: string, uom: string, unitCost: number) =>
      prisma.product.create({ data: { name, sku: s, categoryId, uom, unitCost } });
    const table = await product('Wooden Table', 'TABLE-001', finished.id, 'unit', 120);
    const screws = await product('Screws M6 (box of 100)', 'SCREW-M6', consumables.id, 'box', 4.5);
    const paint = await product('Wood Varnish 1L', 'VARNISH-1L', consumables.id, 'l', 8);
    await product('Oak Plank', 'OAK-PLANK', raw.id, 'm', 12);

    // Reorder rules: screws end LOW, varnish OUT, chairs comfortably OK.
    await prisma.reorderRule.createMany({
      data: [
        { productId: screws.id, minQty: 20, maxQty: 100 },
        { productId: paint.id, minQty: 10, maxQty: 60 },
        { productId: chair.id, minQty: 10, maxQty: 80 },
        { productId: steel.id, minQty: 50, maxQty: 200 },
      ],
    });

    // Move a validated document (and its ledger rows) to a past date, so Move
    // History reads like a week of work instead of one second.
    const backdate = async (
      kind: 'receipt' | 'delivery' | 'transfer' | 'adjustment',
      id: string,
      at: Date,
    ) => {
      const dates = { createdAt: new Date(at.getTime() - 2 * 60 * 60 * 1000), validatedAt: at };
      const model = prisma[kind] as unknown as {
        update: (a: { where: { id: string }; data: typeof dates }) => Promise<unknown>;
      };
      await model.update({ where: { id }, data: dates });
      await prisma.stockMove.updateMany({ where: { docType: kind, docId: id }, data: { doneAt: at, createdAt: at } });
    };

    // --- Validated history -------------------------------------------------
    const r1 = await receipts.create({
      partnerId: supplier.id,
      lines: [
        { productId: steel.id, qty: 100 },
        { productId: screws.id, qty: 50 },
      ],
    });
    await receipts.validate(r1.id, { locationId: main.id }, admin.id);
    await backdate('receipt', r1.id, daysAgo(6));

    const t1 = await transfers.create({
      lines: [{ productId: steel.id, qty: 30, fromLocationId: main.id, toLocationId: rack.id }],
    });
    await transfers.validate(t1.id, admin.id);
    await backdate('transfer', t1.id, daysAgo(5));

    const r2 = await receipts.create({
      partnerId: supplier.id,
      lines: [
        { productId: chair.id, qty: 40 },
        { productId: table.id, qty: 15 },
      ],
    });
    await receipts.validate(r2.id, { locationId: main.id }, admin.id);
    await backdate('receipt', r2.id, daysAgo(4));

    const d1 = await deliveries.create({
      partnerId: customer.id,
      lines: [{ productId: steel.id, qty: 20 }],
    });
    await deliveries.validate(d1.id, { locationId: rack.id }, admin.id);
    await backdate('delivery', d1.id, daysAgo(3));

    const d2 = await deliveries.create({
      partnerId: customer.id,
      lines: [
        { productId: screws.id, qty: 38 },
        { productId: table.id, qty: 3 },
      ],
    });
    await deliveries.validate(d2.id, { locationId: main.id }, admin.id);
    await backdate('delivery', d2.id, daysAgo(2));

    // Physical count: 3 kg of steel damaged at Main Store (70 recorded, 67 counted).
    const a1 = await adjustments.create({
      locationId: main.id,
      lines: [{ productId: steel.id, countedQty: 67 }],
    });
    await adjustments.validate(a1.id, admin.id);
    await backdate('adjustment', a1.id, daysAgo(1));

    // --- Open documents (Dashboard counts, reserved / incoming stock) -------
    const pending = async (
      kind: 'receipt' | 'delivery' | 'transfer',
      doc: { id: string },
      status: DocStatus,
    ) => {
      const svc = { receipt: receipts, delivery: deliveries, transfer: transfers }[kind];
      await svc.updateStatus(doc.id, status);
    };
    await pending(
      'receipt',
      await receipts.create({
        partnerId: supplier.id,
        lines: [
          { productId: paint.id, qty: 60 },
          { productId: screws.id, qty: 100 },
        ],
      }),
      DocStatus.READY,
    );
    await receipts.create({ partnerId: supplier.id, lines: [{ productId: steel.id, qty: 150 }] });
    await pending(
      'delivery',
      await deliveries.create({ partnerId: customer.id, lines: [{ productId: chair.id, qty: 8 }] }),
      DocStatus.READY,
    );
    await pending(
      'delivery',
      await deliveries.create({ partnerId: customer.id, lines: [{ productId: steel.id, qty: 10 }] }),
      DocStatus.WAITING,
    );
    await transfers.create({
      lines: [{ productId: chair.id, qty: 5, fromLocationId: main.id, toLocationId: rack.id }],
    });

    // --- Self-check: the numbers the demo script promises -------------------
    const byLocation = await inventory.locations(steel.id);
    const split = Object.fromEntries(byLocation.map((l) => [l.locationName, l.qty]));
    const { data: rows } = await inventory.list({ page: 1, pageSize: 50 } as never);
    const row = (id: string) => rows.find((r) => r.id === id)!;
    const expect = (label: string, actual: unknown, wanted: unknown) => {
      if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
        throw new Error(`Demo self-check failed: ${label} = ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
      }
    };
    expect('steel on hand', row(steel.id).onHand, 77);
    expect('steel split', split, { 'Main Store': 67, 'Production Rack': 10 });
    expect('steel free to use', row(steel.id).freeToUse, 67);
    expect('screws status', row(screws.id).status, 'LOW');
    expect('varnish status', row(paint.id).status, 'OUT');
    expect('chair free to use', row(chair.id).freeToUse, 32);

    const kpis = await inventory.kpis();
    console.log('Demo data ready.');
    console.log('  Steel Rods: 77 kg on hand (Main Store 67 / Production Rack 10), 67 free to use');
    console.log(`  Stock KPIs: ${JSON.stringify(kpis)}`);
    console.log('  Open: 2 receipts, 2 deliveries, 1 transfer');
    console.log('  Login: admin@stocksense.dev / password123');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
