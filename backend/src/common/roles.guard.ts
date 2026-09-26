import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import type { AuthUser } from './current-user.decorator';

// Authorization on top of authentication. Must run AFTER JwtAuthGuard, which
// populates req.user (incl. role, carried in the JWT). ADMIN is a superuser.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // no @Roles -> allow

    const user = context.switchToHttp().getRequest().user as
      | AuthUser
      | undefined;
    if (!user?.role) {
      throw new ForbiddenException('Missing role');
    }
    if (user.role === UserRole.ADMIN || required.includes(user.role)) {
      return true;
    }
    throw new ForbiddenException(
      `Requires role: ${required.join(' or ')} (you are ${user.role})`,
    );
  }
}
