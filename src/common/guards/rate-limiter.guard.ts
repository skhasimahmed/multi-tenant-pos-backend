import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../modules/redis/redis.service';

export const SKIP_RATE_LIMIT = 'SKIP_RATE_LIMIT';
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT, true);

export const RATE_LIMIT = 'RATE_LIMIT';
export const RateLimit = (limit: number, ttlSeconds = 60) =>
  SetMetadata(RATE_LIMIT, { limit, ttlSeconds });

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    const isSkipped = this.reflector.getAllAndOverride(SKIP_RATE_LIMIT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isSkipped) {
      return true;
    }

    const rateConfig = this.reflector.getAllAndOverride(RATE_LIMIT, [
      context.getHandler(),
      context.getClass(),
    ]) || {
      limit: 100,
      ttlSeconds: 60,
    };

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const ip = request.ip || request.socket?.remoteAddress || '127.0.0.1';
    const pathKey = request.route?.path || request.path || 'global';
    const key = `rate_limit:${request.method}:${pathKey}:${ip}`;

    const currentStr = await this.redisService.get(key);
    const count = currentStr ? Number(currentStr) : 0;

    if (count >= rateConfig.limit) {
      if (response.header) {
        response.header('Retry-After', String(rateConfig.ttlSeconds));
      }
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.redisService.set(
      key,
      String(count + 1),
      count === 0 ? rateConfig.ttlSeconds : undefined,
    );

    if (response.header) {
      response.header('X-RateLimit-Limit', String(rateConfig.limit));
      response.header(
        'X-RateLimit-Remaining',
        String(Math.max(0, rateConfig.limit - (count + 1))),
      );
    }

    return true;
  }
}
