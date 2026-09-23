import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno en la base de datos.';
    let error = 'DatabaseError';

    switch (exception.code) {
      // P2002: Violación de restricción única (Unique constraint violation)
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[])?.join(', ') || 'campo';
        message = `Ya existe un registro con el mismo valor para: ${target}.`;
        error = 'Conflict';
        break;
      }

      // P2025: Registro requerido no encontrado (Record not found)
      case 'P2025': {
        status = HttpStatus.NOT_FOUND;
        message = (exception.meta?.cause as string) || 'El recurso solicitado no fue encontrado.';
        error = 'NotFound';
        break;
      }

      // P2003: Violación de clave foránea (Foreign key constraint violation)
      case 'P2003': {
        status = HttpStatus.BAD_REQUEST;
        const field = (exception.meta?.field_name as string) || 'referencia';
        message = `No se puede completar la operación debido a una referencia inválida (${field}).`;
        error = 'BadRequest';
        break;
      }

      default:
        this.logger.error(`Error Prisma no controlado [${exception.code}]: ${exception.message}`, exception.stack);
        break;
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      code: exception.code,
      timestamp: new Date().toISOString(),
    });
  }
}
