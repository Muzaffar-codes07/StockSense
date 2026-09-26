import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StockQueryDto } from './stock-query.dto';

// Mirrors Nest's ValidationPipe (transform: true): plainToInstance + validate.
const parse = async (query: Record<string, unknown>) => {
  const dto = plainToInstance(StockQueryDto, query, { enableImplicitConversion: true });
  return { dto, errors: await validate(dto, { whitelist: true }) };
};

describe('StockQueryDto status', () => {
  it('accepts any letter case: ?status=low means LOW', async () => {
    const { dto, errors } = await parse({ status: 'low' });
    expect(errors).toHaveLength(0);
    expect(dto.status).toBe('LOW');
  });

  it('treats an empty ?status= as no filter', async () => {
    const { dto, errors } = await parse({ status: '' });
    expect(errors).toHaveLength(0);
    expect(dto.status).toBeUndefined();
  });

  it('still rejects an unknown status', async () => {
    const { errors } = await parse({ status: 'sideways' });
    expect(errors[0]?.constraints).toEqual({ isIn: 'status must be one of OK, LOW, OUT' });
  });
});
