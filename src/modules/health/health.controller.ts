import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { SkipRateLimit } from '../../common/guards/rate-limiter.guard';

@SkipRateLimit()
@Controller()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Get('health')
  async checkHealth(@Res({ passthrough: true }) res: Response) {
    let db = 'up';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      db = 'down';
    }

    let redis = 'up';
    try {
      const ok = await this.redisService.ping();
      if (!ok) redis = 'down';
    } catch {
      redis = 'down';
    }

    const isHealthy = db === 'up';
    if (!isHealthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      checks: {
        database: db,
        redis,
      },
    };
  }

  @Get()
  checkRoot() {
    return {
      name: 'pos-backend',
      version: '1.0.0',
      status: 'ok',
    };
  }
}
