import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { generateEndpointSecret } from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export const DEMO_EMAIL = 'demo@hookpilot.test';
export const DEMO_PASSWORD = 'password123';
export const DEMO_NAME = 'Demo User';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
      },
    });

    return this.buildAuthResponse(user.id, user.email, user.name);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.buildAuthResponse(user.id, user.email, user.name);
  }

  /** One-click demo login for portfolio / local showcase. */
  async demoLogin() {
    const enabled =
      this.config.get('DEMO_LOGIN_ENABLED', 'true') !== 'false' &&
      this.config.get('NODE_ENV', 'development') !== 'production';

    if (!enabled) {
      throw new ForbiddenException('Demo login is disabled');
    }

    let user = await this.prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      user = await this.prisma.user.create({
        data: {
          email: DEMO_EMAIL,
          passwordHash,
          name: DEMO_NAME,
        },
      });
    }

    await this.ensureDemoProject(user.id);

    return this.buildAuthResponse(user.id, user.email, user.name);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return user;
  }

  private async ensureDemoProject(userId: string) {
    const existing = await this.prisma.project.findFirst({
      where: { userId, name: 'Demo Shop' },
    });
    if (existing) return existing;

    return this.prisma.project.create({
      data: {
        name: 'Demo Shop',
        description: '샘플 프로젝트 — Endpoint를 등록하고 테스트 이벤트를 보내보세요.',
        userId,
        endpoints: {
          create: {
            name: 'httpbin',
            url: 'https://httpbin.org/post',
            secret: generateEndpointSecret(),
            enabled: true,
          },
        },
      },
    });
  }

  private buildAuthResponse(id: string, email: string, name: string) {
    const accessToken = this.jwt.sign({ sub: id, email });
    return {
      accessToken,
      user: { id, email, name },
    };
  }
}
