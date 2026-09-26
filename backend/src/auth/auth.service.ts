import {
  BadRequestException,
  Injectable,
  ConflictException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, ResetPasswordDto, SignUpDto } from './dto/auth.dto';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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

  // Current user for the frontend's login-state check (never returns the hash).
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return user;
  }

  // Issue a password-reset OTP. Never reveals whether the email exists
  // (anti-enumeration): the response is identical either way. In non-production
  // the code is also returned as `devOtp` so the demo/dev panel can show it —
  // in production it is only logged/sent (keeps us off third-party APIs).
  async requestOtp(email: string) {
    const generic = {
      message: 'If that email is registered, a reset code has been sent.',
    };
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return generic;

    // Only one active code at a time — invalidate previous unused ones.
    await this.prisma.passwordResetOtp.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        otpCode: await argon2.hash(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    // Never log the plaintext code in production (secret in logs). In real
    // deployment this is where an email/SMS send would go instead.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`Password reset code for ${email}: ${code} (valid 10m)`);
      return { ...generic, devOtp: code };
    }
    return generic;
  }

  // Verify the latest active OTP and set the new password. Generic errors and
  // an attempt cap keep it safe against enumeration and brute force.
  async resetPassword(dto: ResetPasswordDto) {
    const invalid = new BadRequestException('Invalid or expired code');
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw invalid;

    const otp = await this.prisma.passwordResetOtp.findFirst({
      where: { userId: user.id, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw invalid;

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.passwordResetOtp.update({
        where: { id: otp.id },
        data: { used: true },
      });
      throw invalid;
    }

    if (!(await argon2.verify(otp.otpCode, dto.otpCode))) {
      await this.prisma.passwordResetOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid;
    }

    // Success: set the new password and burn the code, atomically.
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.passwordResetOtp.update({
        where: { id: otp.id },
        data: { used: true },
      }),
    ]);
    return { message: 'Password updated. Please log in.' };
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
