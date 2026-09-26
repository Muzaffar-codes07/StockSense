import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './product.dto';

async function check(body: object) {
  const dto = plainToInstance(CreateProductDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('CreateProductDto', () => {
  it('normalises SKU case and whitespace so " steel-001 " and "STEEL-001" collide', async () => {
    const { dto, fields } = await check({ name: ' Steel Rods ', sku: ' steel-001 ' });
    expect(fields).toEqual([]);
    expect(dto.sku).toBe('STEEL-001');
    expect(dto.name).toBe('Steel Rods');
  });

  it('rejects SKUs with spaces or symbols', async () => {
    expect((await check({ name: 'Steel', sku: 'ST EEL' })).fields).toEqual(['sku']);
    expect((await check({ name: 'Steel', sku: 'STEEL#1' })).fields).toEqual(['sku']);
  });

  it('rejects a blank name', async () => {
    expect((await check({ name: '   ', sku: 'A1' })).fields).toEqual(['name']);
  });

  it('rejects an unknown unit of measure and a negative cost', async () => {
    const { fields } = await check({ name: 'Steel', sku: 'A1', uom: 'bags', unitCost: -1 });
    expect(fields.sort()).toEqual(['unitCost', 'uom']);
  });

  it('rejects initial stock with more than 3 decimals or zero', async () => {
    expect((await check({ name: 'S', sku: 'A1', initialStock: { qty: 1.0005 } })).fields).toEqual(['initialStock']);
    expect((await check({ name: 'S', sku: 'A1', initialStock: { qty: 0 } })).fields).toEqual(['initialStock']);
  });

  it('accepts a full valid product', async () => {
    const { fields } = await check({
      name: 'Steel', sku: 'STEEL-001', uom: 'kg', unitCost: 12.5,
      initialStock: { qty: 100.25 },
    });
    expect(fields).toEqual([]);
  });
});
