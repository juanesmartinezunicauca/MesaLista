import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: {
    getAllAndOverride: jest.Mock;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  it('debe permitir acceso si la ruta tiene el decorador @Public()', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('debe delegar a super.canActivate si la ruta no es pública', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const superSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
        getResponse: jest.fn().mockReturnValue({}),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);
    expect(result).toBe(true);
    superSpy.mockRestore();
  });

  it('debe intentar poblar req.user en rutas @Public() cuando viene Authorization Bearer y permitir acceso aunque el token falle', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const superSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockRejectedValue(new Error('Token expirado'));

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: { authorization: 'Bearer token-vencido' },
        }),
        getResponse: jest.fn().mockReturnValue({}),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(superSpy).toHaveBeenCalledWith(context);
    expect(result).toBe(true);
    superSpy.mockRestore();
  });
});
