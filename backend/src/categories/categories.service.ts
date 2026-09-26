import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto } from './dto/category.dto';

const NAME_TAKEN = 'A category with this name already exists';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return categories.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products }));
  }

  async create(dto: CategoryDto) {
    try {
      return await this.prisma.category.create({ data: { name: dto.name } });
    } catch (e) {
      throw isUniqueViolation(e) ? new ConflictException(NAME_TAKEN) : e;
    }
  }

  async update(id: string, dto: CategoryDto) {
    await this.find(id);
    try {
      return await this.prisma.category.update({ where: { id }, data: { name: dto.name } });
    } catch (e) {
      throw isUniqueViolation(e) ? new ConflictException(NAME_TAKEN) : e;
    }
  }

  async remove(id: string): Promise<void> {
    const category = await this.find(id);
    const count = category._count.products;
    if (count > 0) {
      throw new ConflictException(
        `This category still has ${count} product(s); move them to another category first`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async find(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }
}
