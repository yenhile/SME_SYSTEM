import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async checkTaxCode(taxCode: string) {
    const company = await this.prisma.company.findUnique({
      where: { taxCode },
      include: {
        loans: {
          select: {
            id: true,
            applicationCode: true,
            proposedAmount: true,
            currentStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    });

    if (!company) {
      return { found: false, company: null };
    }
    return { found: true, company };
  }

  async findAll(keyword?: string) {
    return this.prisma.company.findMany({
      where: keyword
        ? {
            OR: [
              { companyName: { contains: keyword, mode: 'insensitive' } },
              { taxCode: { contains: keyword } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsert(data: {
    taxCode: string;
    companyName: string;
    industry: string;
    establishedYear: number;
    annualRevenue: number;
    charterCapital: number;
    representativeName: string;
    phone: string;
    address: string;
  }) {
    return this.prisma.company.upsert({
      where: { taxCode: data.taxCode },
      update: {
        companyName: data.companyName,
        industry: data.industry,
        establishedYear: data.establishedYear,
        annualRevenue: data.annualRevenue,
        charterCapital: data.charterCapital,
        representativeName: data.representativeName,
        phone: data.phone,
        address: data.address,
      },
      create: data,
    });
  }
}
