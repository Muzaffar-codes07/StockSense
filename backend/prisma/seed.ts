import { PrismaClient, LocationType, PartnerType } from '@prisma/client';
import * as argon2 from 'argon2';

// Seed enough data that the app looks alive on first run and the demo flow
// (Receive 100 -> Transfer -> Deliver 20 -> Adjust -3) has real products/locations.
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('password123');
  await prisma.user.upsert({
    where: { email: 'admin@stocksense.dev' },
    update: {},
    create: { name: 'Admin', email: 'admin@stocksense.dev', passwordHash },
  });

  const wh = await prisma.warehouse.create({
    data: { name: 'Main Warehouse', address: '1 Industrial Way' },
  });
  const mainStore = await prisma.location.create({
    data: { warehouseId: wh.id, name: 'Main Store', type: LocationType.STOCK },
  });
  const productionRack = await prisma.location.create({
    data: {
      warehouseId: wh.id,
      name: 'Production Rack',
      type: LocationType.PRODUCTION,
    },
  });

  const raw = await prisma.category.create({ data: { name: 'Raw Materials' } });
  const finished = await prisma.category.create({
    data: { name: 'Finished Goods' },
  });

  await prisma.product.createMany({
    data: [
      { name: 'Steel Rods', sku: 'STEEL-001', categoryId: raw.id, uom: 'kg', unitCost: 1.5 },
      { name: 'Office Chair', sku: 'CHAIR-001', categoryId: finished.id, uom: 'unit', unitCost: 45.0 },
    ],
  });

  await prisma.partner.createMany({
    data: [
      { name: 'Acme Steel Co.', type: PartnerType.SUPPLIER },
      { name: 'Beta Retailers', type: PartnerType.CUSTOMER },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete. Login: admin@stocksense.dev / password123');
  console.log('Locations:', { mainStore: mainStore.id, productionRack: productionRack.id });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
