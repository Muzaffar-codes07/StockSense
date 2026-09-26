import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

// Mock the Prisma surface AuthService.requestOtp/resetPassword touch.
// argon2 is used for real (hermetic, fast enough) so hashing/verify is exercised.
function makePrisma() {
  return {
    user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    passwordResetOtp: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'otp1' }),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('AuthService — OTP password reset', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: AuthService;
  const OLD_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuthService(prisma as never, { signAsync: jest.fn() } as never);
    process.env.NODE_ENV = 'test';
  });
  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  describe('requestOtp', () => {
    it('returns a generic message and creates nothing for an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await service.requestOtp('nobody@example.com');
      expect(res).not.toHaveProperty('devOtp');
      expect(prisma.passwordResetOtp.create).not.toHaveBeenCalled();
    });

    it('invalidates prior codes, stores a HASHED 6-digit code, and returns devOtp (non-prod)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.co' });
      const res = (await service.requestOtp('a@b.co')) as { devOtp?: string };
      expect(prisma.passwordResetOtp.updateMany).toHaveBeenCalled(); // old ones burned
      const created = prisma.passwordResetOtp.create.mock.calls[0][0].data;
      expect(res.devOtp).toMatch(/^\d{6}$/);
      expect(created.otpCode).not.toBe(res.devOtp); // stored value is a hash
      await expect(argon2.verify(created.otpCode, res.devOtp!)).resolves.toBe(true);
    });

    it('never returns devOtp in production', async () => {
      process.env.NODE_ENV = 'production';
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.co' });
      expect(await service.requestOtp('a@b.co')).not.toHaveProperty('devOtp');
    });
  });

  describe('resetPassword', () => {
    async function activeOtp(code = '123456', over: Record<string, unknown> = {}) {
      return {
        id: 'otp1',
        otpCode: await argon2.hash(code),
        used: false,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
        ...over,
      };
    }

    it('updates the password and burns the code on a correct OTP', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.co' });
      prisma.passwordResetOtp.findFirst.mockResolvedValue(await activeOtp('654321'));
      const res = await service.resetPassword({
        email: 'a@b.co',
        otpCode: '654321',
        newPassword: 'newpass123',
      });
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.message).toMatch(/updated/i);
    });

    it('rejects a wrong code and increments attempts', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.co' });
      prisma.passwordResetOtp.findFirst.mockResolvedValue(await activeOtp('111111'));
      await expect(
        service.resetPassword({ email: 'a@b.co', otpCode: '999999', newPassword: 'newpass123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.passwordResetOtp.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { attempts: { increment: 1 } } }),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects when no active (unused, unexpired) code exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.co' });
      prisma.passwordResetOtp.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword({ email: 'a@b.co', otpCode: '123456', newPassword: 'newpass123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('burns the code once the attempt cap is hit', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.co' });
      prisma.passwordResetOtp.findFirst.mockResolvedValue(await activeOtp('123456', { attempts: 5 }));
      await expect(
        service.resetPassword({ email: 'a@b.co', otpCode: '123456', newPassword: 'newpass123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.passwordResetOtp.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { used: true } }),
      );
    });

    it('rejects an unknown email generically', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPassword({ email: 'x@y.z', otpCode: '123456', newPassword: 'newpass123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
