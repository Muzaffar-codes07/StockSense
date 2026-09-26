import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OperationQueryDto } from './operation-query.dto';
import { MoveHistoryQueryDto } from './move-history-query.dto';

// Nest's ValidationPipe (transform: true, whitelist: true) runs
// plainToInstance + validate on query params. The UI sends empty-string
// params like `?status=` when a filter is set to "All"; these must be treated
// as absent, not rejected. Regression guard for that fix.
describe('operations query DTOs — empty-string filter params', () => {
  const transformAndValidate = async <T extends object>(
    cls: new () => T,
    query: Record<string, unknown>,
  ) => {
    const dto = plainToInstance(cls, query, {
      enableImplicitConversion: true,
    });
    const errors = await validate(dto, { whitelist: true });
    return { dto, errors };
  };

  describe('OperationQueryDto', () => {
    it('accepts empty-string status/partnerId/locationId and treats them as absent', async () => {
      const { dto, errors } = await transformAndValidate(OperationQueryDto, {
        status: '',
        partnerId: '',
        locationId: '',
      });
      expect(errors).toHaveLength(0);
      expect(dto.status).toBeUndefined();
      expect(dto.partnerId).toBeUndefined();
      expect(dto.locationId).toBeUndefined();
    });

    it('still accepts a valid status enum value', async () => {
      const { dto, errors } = await transformAndValidate(OperationQueryDto, {
        status: 'DONE',
      });
      expect(errors).toHaveLength(0);
      expect(dto.status).toBe('DONE');
    });

    it('still rejects a non-empty invalid status', async () => {
      const { errors } = await transformAndValidate(OperationQueryDto, {
        status: 'NOPE',
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('still rejects a non-empty invalid UUID filter', async () => {
      const { errors } = await transformAndValidate(OperationQueryDto, {
        partnerId: 'not-a-uuid',
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('partnerId');
    });
  });

  describe('MoveHistoryQueryDto', () => {
    it('accepts empty-string moveType and location filters as absent', async () => {
      const { dto, errors } = await transformAndValidate(MoveHistoryQueryDto, {
        moveType: '',
        locationId: '',
        productId: '',
        startDate: '',
        endDate: '',
      });
      expect(errors).toHaveLength(0);
      expect(dto.moveType).toBeUndefined();
      expect(dto.locationId).toBeUndefined();
      expect(dto.productId).toBeUndefined();
      expect(dto.startDate).toBeUndefined();
      expect(dto.endDate).toBeUndefined();
    });

    it('still accepts a valid moveType enum value', async () => {
      const { dto, errors } = await transformAndValidate(MoveHistoryQueryDto, {
        moveType: 'RECEIPT',
      });
      expect(errors).toHaveLength(0);
      expect(dto.moveType).toBe('RECEIPT');
    });

    it('still rejects a non-empty invalid moveType', async () => {
      const { errors } = await transformAndValidate(MoveHistoryQueryDto, {
        moveType: 'BOGUS',
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('moveType');
    });
  });
});
