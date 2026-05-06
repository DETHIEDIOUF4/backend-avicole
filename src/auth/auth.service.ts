import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type TokenPayload = {
  sub: string;
  phone: string;
  role: 'ADMIN' | 'MANAGER';
  tokenType: 'access' | 'refresh';
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async login(phone: string, password: string) {
    const user = await this.usersService.findByPhone(phone);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    return this.issueAuthTokens(user);
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Compte invalide');
    }

    const foundToken = await this.prisma.refreshToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!foundToken) {
      throw new UnauthorizedException('Session invalide');
    }

    const isMatch = await bcrypt.compare(refreshToken, foundToken.tokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Session invalide');
    }

    // delete() lève P2025 si la ligne a déjà été supprimée (ex. double appel refresh en parallèle).
    const removed = await this.prisma.refreshToken.deleteMany({
      where: { id: foundToken.id },
    });
    if (removed.count === 0) {
      throw new UnauthorizedException('Session déjà rafraîchie');
    }
    return this.issueAuthTokens(user);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { success: true };
  }

  private async issueAuthTokens(user: User) {
    const accessPayload: TokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      tokenType: 'access',
    };

    const refreshPayload: TokenPayload = {
      ...accessPayload,
      tokenType: 'refresh',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn:
        (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as any,
    });

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn:
        (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as any,
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = this.getRefreshExpiryDate();
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Refresh token invalide');
      }
      return payload;
    } catch (_error) {
      throw new UnauthorizedException('Refresh token invalide');
    }
  }

  private getRefreshExpiryDate() {
    const expiresInRaw =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const match = expiresInRaw.match(/^(\d+)([smhd])$/);
    if (!match) {
      const date = new Date();
      date.setDate(date.getDate() + 7);
      return date;
    }
    const value = Number(match[1]);
    const unit = match[2];
    const msPerUnit: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return new Date(Date.now() + value * msPerUnit[unit]);
  }
}
