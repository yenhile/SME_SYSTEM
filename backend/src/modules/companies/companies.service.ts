import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { assertOfficerMayWriteCompany } from './company-access';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  /** CBTD chỉ làm việc với doanh nghiệp có hồ sơ gán cho mình; các vai trò khác giữ phạm vi toàn chi nhánh. */
  private isOfficer(user?: { activeRole?: string }) {
    return user?.activeRole === 'CBTD';
  }

  async checkTaxCode(taxCode: string, user?: { id: string; activeRole?: string }) {
    const officer = this.isOfficer(user);
    const company = await this.prisma.company.findUnique({
      where: { taxCode },
      include: {
        loans: {
          ...(officer ? { where: { assignedTo: user!.id } } : {}),
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
    // Doanh nghiệp có trong hệ thống nhưng không thuộc hồ sơ của CBTD này: chỉ báo đã tồn tại, không lộ thông tin.
    if (officer && company.loans.length === 0) {
      return { found: true, restricted: true, company: null };
    }
    return { found: true, company };
  }

  async findAll(user?: { id: string; activeRole?: string }, keyword?: string) {
    const conditions: any[] = [];
    if (this.isOfficer(user)) conditions.push({ loans: { some: { assignedTo: user!.id } } });
    if (keyword) {
      conditions.push({
        OR: [
          { companyName: { contains: keyword, mode: 'insensitive' } },
          { taxCode: { contains: keyword } },
        ],
      });
    }
    return this.prisma.company.findMany({
      where: conditions.length ? { AND: conditions } : undefined,
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
  }, user?: { id: string; activeRole?: string }) {
    if (this.isOfficer(user)) await assertOfficerMayWriteCompany(this.prisma, data.taxCode, user!.id);
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
