import { PrismaClient } from '@prisma/client';
import { CategoriesService } from './categories.service';

// Archived products are invisible everywhere, so they must not pin a category.
describe('CategoriesService (live DB)', () => {
  const prisma = new PrismaClient();
  const service = new CategoriesService(prisma as never);
  const tag = `T${Date.now()}`;
  let categoryId: string;

  beforeAll(async () => {
    categoryId = (await prisma.category.create({ data: { name: `${tag} Old Stock` } })).id;
    await prisma.product.create({
      data: { name: `${tag} Retired`, sku: `${tag}-RET`, categoryId, isActive: false },
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { sku: `${tag}-RET` } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  it('does not count archived products', async () => {
    const row = (await service.list()).find((c) => c.id === categoryId);
    expect(row?.productCount).toBe(0);
  });

  it('deletes a category whose products are all archived', async () => {
    await service.remove(categoryId);
    expect(await prisma.category.count({ where: { id: categoryId } })).toBe(0);
  });
});
