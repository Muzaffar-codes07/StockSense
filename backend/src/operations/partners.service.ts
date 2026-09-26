import { Injectable, NotFoundException } from '@nestjs/common';
import { PartnerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerDto, PartnerQueryDto } from './dto/partner.dto';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query?: PartnerQueryDto) {
    const where: any = {};
    if (query?.type) {
      where.type = query.type;
    }
    if (query?.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    return this.prisma.partner.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
    });
    if (!partner) {
      throw new NotFoundException(`Partner with ID ${id} not found`);
    }
    return partner;
  }

  async create(dto: PartnerDto) {
    return this.prisma.partner.create({
      data: {
        name: dto.name,
        type: dto.type,
      },
    });
  }

  async update(id: string, dto: PartnerDto) {
    await this.findOne(id);
    return this.prisma.partner.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.partner.delete({
      where: { id },
    });
  }
}
