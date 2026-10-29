import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memoryStore = new Map();
  private isConnected = false;

  constructor() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.REDIS_ENABLED === 'false'
    ) {
      this.isConnected = false;
      return;
    }

    const host = process.env.REDIS_HOST || 'localhost';
    const port = Number(process.env.REDIS_PORT) || 6379;

    try {
      this.client = new Redis({
        host,
        port,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        enableOfflineQueue: false,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Connected to Redis at ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          this.logger.warn(
            `Redis connection error: ${err.message}. Operating in memory fallback mode.`,
          );
        }
        this.isConnected = false;
      });
    } catch (err: any) {
      this.logger.warn(
        `Could not initialize Redis client: ${err?.message || err}. Using in-memory store.`,
      );
      this.isConnected = false;
    }
  }

  async ping() {
    if (this.isConnected && this.client) {
      try {
        await this.client.ping();
        return true;
      } catch (err: any) {
        this.logger.debug(`Redis ping failed: ${err?.message || err}`);
        return false;
      }
    }
    return true;
  }

  async get(key: string) {
    if (this.isConnected && this.client) {
      try {
        return await this.client.get(key);
      } catch (err: any) {
        this.logger.warn(
          `Redis GET failed for key "${key}": ${err?.message || err}. Reading from memory cache.`,
        );
      }
    }

    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (this.isConnected && this.client) {
      try {
        if (ttlSeconds) {
          await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch (err: any) {
        this.logger.warn(
          `Redis SET failed for key "${key}": ${err?.message || err}. Storing in memory cache.`,
        );
      }
    }

    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.memoryStore.set(key, { value, expiresAt });
  }

  async del(key: string) {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (err: any) {
        this.logger.warn(
          `Redis DEL failed for key "${key}": ${err?.message || err}. Deleting from memory cache.`,
        );
      }
    }
    this.memoryStore.delete(key);
  }

  async delPattern(pattern: string) {
    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } catch (err: any) {
        this.logger.warn(
          `Redis DEL pattern failed for "${pattern}": ${err?.message || err}. Evicting from memory cache.`,
        );
      }
    }

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.memoryStore.keys()) {
      if (regex.test(key)) {
        this.memoryStore.delete(key);
      }
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        this.client.disconnect(false);
      } catch (err: any) {
        this.logger.debug(
          `Error during Redis disconnection: ${err?.message || err}`,
        );
      }
    }
  }
}
