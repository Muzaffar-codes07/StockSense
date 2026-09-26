import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Usage: @Roles(UserRole.MANAGER) on a handler/controller. Requires RolesGuard
// (and JwtAuthGuard before it). ADMIN is always allowed (see RolesGuard).
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
