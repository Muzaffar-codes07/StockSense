import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

// Build a guard whose Reflector returns `required`, against a request carrying `user`.
function makeGuard(required: UserRole[] | undefined, user: unknown) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) };
  const guard = new RolesGuard(reflector as never);
  const ctx = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
  return () => guard.canActivate(ctx as never);
}

describe('RolesGuard', () => {
  it('allows when no @Roles metadata is present', () => {
    expect(makeGuard(undefined, { role: UserRole.STAFF })()).toBe(true);
    expect(makeGuard([], { role: UserRole.STAFF })()).toBe(true);
  });

  it('allows when the user has the required role', () => {
    expect(makeGuard([UserRole.MANAGER], { role: UserRole.MANAGER })()).toBe(true);
  });

  it('treats ADMIN as a superuser for any requirement', () => {
    expect(makeGuard([UserRole.MANAGER], { role: UserRole.ADMIN })()).toBe(true);
  });

  it('forbids when the user lacks the required role', () => {
    expect(() => makeGuard([UserRole.MANAGER], { role: UserRole.STAFF })()).toThrow(
      ForbiddenException,
    );
  });

  it('forbids when there is no role on the request', () => {
    expect(() => makeGuard([UserRole.MANAGER], {})()).toThrow(ForbiddenException);
  });
});
