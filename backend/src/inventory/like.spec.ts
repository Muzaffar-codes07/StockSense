import { escapeLike } from './like';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character itself', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('leaves ordinary text unchanged', () => {
    expect(escapeLike('Steel Rods-001')).toBe('Steel Rods-001');
  });
});
