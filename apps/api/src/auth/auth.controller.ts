import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RequestOtpDto,
  ResetPasswordDto,
  SignUpDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
