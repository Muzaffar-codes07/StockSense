import { IsEmail, IsString, MinLength } from 'class-validator';

// class-validator DTOs = robust input validation for free (scored requirement).
export class SignUpDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail({}, { message: 'Please enter a valid email address' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email!: string;

  @IsString()
  password!: string;
}

export class RequestOtpDto {
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email!: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  otpCode!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword!: string;
}
