import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import {
  LoginDto,
  RequestOtpDto,
  ResetPasswordDto,
  SignUpDto,
} from './dto/auth.dto';

// Rate-limit the credential/OTP endpoints (defeats stuffing + OTP re-request
// spam that would otherwise bypass the per-code attempt cap). Scoped to this
// controller so other roles' endpoints are unaffected.
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Frontend login-state check: 200 + user when the JWT is valid, else 401.
  // Not credential-sensitive, and polled by the SPA — exempt from throttling.
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.sub);
  }

  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.auth.signUp(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Tighter: OTP requests overwrite the prior code, so cap re-requests hard.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('request-otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }
}
