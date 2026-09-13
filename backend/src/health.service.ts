import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    let database = 'unavailable';
    let prediction = 'unavailable';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'ready';
    } catch {}

    try {
      const url = process.env.ML_SERVICE_URL ?? 'http://localhost:8000';
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) prediction = 'ready';
    } catch {}

    const status = database === 'ready' && prediction === 'ready' ? 'ok' : 'degraded';
    return {
      status,
      services: { backend: 'ready', database, prediction },
      timestamp: new Date().toISOString(),
    };
  }
}
