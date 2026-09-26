import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoriesService } from './categories.service';

function make() {
  const prisma = {
    category: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', name: 'Raw Materials', _count: { products: 2 } },
      ]),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'c2', name: 'Tools' }),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  return { prisma, service: new CategoriesService(prisma as never) };
}

describe('CategoriesService', () => {
  it('lists categories with product counts', async () => {
    const { service } = make();
    expect(await service.list()).toEqual([{ id: 'c1', name: 'Raw Materials', productCount: 2 }]);
  });

  it('turns a duplicate name into a 409', async () => {
    const { prisma, service } = make();
    prisma.category.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(service.create({ name: 'Tools' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to delete a category that still has products', async () => {
    const { prisma, service } = make();
    prisma.category.findUnique.mockResolvedValue({ id: 'c1', _count: { products: 2 } });
    await expect(service.remove('c1')).rejects.toThrow(
      'This category still has 2 product(s); move them to another category first',
    );
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty category', async () => {
    const { prisma, service } = make();
    prisma.category.findUnique.mockResolvedValue({ id: 'c1', _count: { products: 0 } });
    await service.remove('c1');
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('404s for a missing category', async () => {
    const { prisma, service } = make();
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.remove('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
