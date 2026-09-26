import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, ResetPasswordDto, SignUpDto } from './dto/auth.dto';

// SKELETON (Role 1). Sign-up + login are implemented so the app is usable;
// OTP methods are stubbed for you to finish. See docs/Role-1-Backend-Core-Data.md.
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signUp(dto: SignUpDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash },
    });
    return this.issueTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(user.id, user.email);
  }

  // TODO(Role 1): generate a 6-digit OTP, store in PasswordResetOtp with a
  // short expiry, and send via SMTP (or surface in a dev panel for the demo).
  async requestOtp(_email: string) {
    throw new Error('Not implemented: OTP request');
  }

  // TODO(Role 1): verify the OTP (exists, not used, not expired), then
  // argon2-hash and set the new password, and mark the OTP used.
  async resetPassword(_dto: ResetPasswordDto) {
    throw new Error('Not implemented: password reset');
  }

  private async issueTokens(sub: string, email: string) {
    const payload = { sub, email };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    });
    return { accessToken };
  }
}
