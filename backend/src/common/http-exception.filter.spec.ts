import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';

function run(exception: unknown) {
  const json = jest.fn((_body: any) => undefined);
  const res = { status: jest.fn((_code: number) => ({ json })) };
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return { status: res.status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`raw ${code} detail`, {
    code,
    clientVersion: 'test',
  });

describe('HttpExceptionFilter', () => {
  it('keeps HttpException status and message', () => {
    const { status, body } = run(new NotFoundException('Nope'));
    expect(status).toBe(404);
    expect(body).toMatchObject({ success: false, statusCode: 404, message: 'Nope' });
  });

  it('maps a foreign-key violation (P2003) to 400 without leaking Prisma detail', () => {
    const { status, body } = run(prismaError('P2003'));
    expect(status).toBe(400);
    expect(body.message).toBe('A referenced record (product, location, category…) does not exist');
  });

  it('maps record-not-found (P2025) to 404', () => {
    expect(run(prismaError('P2025')).status).toBe(404);
  });

  it('maps a unique violation (P2002) to 409', () => {
    expect(run(prismaError('P2002')).status).toBe(409);
  });

  it('hides unknown errors behind a generic 500 message', () => {
    const { status, body } = run(new Error('connection string with password'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
  });
});
