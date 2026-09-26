import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import {
  LoginDto,
  RequestOtpDto,
  ResetPasswordDto,
  SignUpDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Frontend login-state check: 200 + user when the JWT is valid, else 401.
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

  @Post('request-otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }
}
