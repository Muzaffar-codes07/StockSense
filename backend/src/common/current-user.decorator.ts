import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export interface AuthUser {
  sub: string;
  email: string;
  role: UserRole;
}

// Usage: someHandler(@CurrentUser() user: AuthUser) { ... }
// Requires JwtAuthGuard to have run.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);
