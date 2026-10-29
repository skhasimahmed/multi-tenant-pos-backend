import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './jwt.strategy';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        merchantId: user.merchantId,
        storeId: user.storeId,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET || 'pos_jwt_refresh_secret_key_123';

    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: refreshSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const activeToken = await this.redisService.get(
      `refresh_token:${payload.sub}`,
    );
    if (!activeToken || activeToken !== dto.refreshToken) {
      throw new UnauthorizedException(
        'Refresh token has been revoked or expired',
      );
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists or is inactive');
    }

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string, token?: string) {
    await this.redisService.del(`refresh_token:${userId}`);
    if (token) {
      const expiresIn = process.env.JWT_EXPIRATION || '900s';
      const ttlSeconds = parseInt(expiresIn.replace(/\D/g, ''), 10) || 900;
      await this.redisService.set(`blacklist:${token}`, 'revoked', ttlSeconds);
    }
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      merchantId: user.merchantId,
      storeId: user.storeId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshSecret =
      process.env.JWT_REFRESH_SECRET || 'pos_jwt_refresh_secret_key_123';
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRATION || '28800s';
    const ttlSeconds =
      parseInt(refreshExpiresIn.replace(/\D/g, ''), 10) || 28800;

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as any,
        algorithm: 'HS256',
      },
    );

    await this.redisService.set(
      `refresh_token:${user.id}`,
      refreshToken,
      ttlSeconds,
    );

    return { accessToken, refreshToken };
  }
}
