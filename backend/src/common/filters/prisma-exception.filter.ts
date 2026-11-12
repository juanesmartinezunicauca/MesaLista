import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno en la base de datos.';
    let error = 'DatabaseError';
    let code: string | undefined = undefined;

    if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Los datos suministrados no cumplen con el esquema o tipos requeridos por el modelo de datos.';
      error = 'BadRequest';
      code = 'VALIDATION_ERROR';
    } else {
      code = exception.code;
      switch (exception.code) {
      // P2000: El valor proporcionado es demasiado largo para el tipo de columna (String length overflow)
      case 'P2000': {
        status = HttpStatus.BAD_REQUEST;
        const column = (exception.meta?.column_name as string) || (exception.meta?.target as string) || 'campo';
        message = `El valor proporcionado es demasiado largo para el campo: ${column}.`;
        error = 'BadRequest';
        break;
      }

      // P2002: Violación de restricción única (Unique constraint violation)
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[])?.join(', ') || 'campo';
        message = `Ya existe un registro con el mismo valor para: ${target}.`;
        error = 'Conflict';
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

      // P2006: El valor proporcionado no es válido para el campo
      case 'P2006': {
        status = HttpStatus.BAD_REQUEST;
        message = 'El valor proporcionado no es válido para el formato o tipo esperado del campo.';
        error = 'BadRequest';
        break;
      }

      // P2011: Violación de restricción de no nulo (Null constraint violation)
      case 'P2011': {
        status = HttpStatus.BAD_REQUEST;
        const constraint = (exception.meta?.constraint as string) || 'campo obligatorio';
        message = `No se admiten valores nulos para: ${constraint}.`;
        error = 'BadRequest';
        break;
      }

      // P2020: Valor fuera de rango para el tipo (ej. Integer 32-bit overflow en PostgreSQL)
      case 'P2020': {
        status = HttpStatus.BAD_REQUEST;
        message = 'Uno de los valores numéricos suministrados excede el rango máximo admitido por la base de datos (desbordamiento numérico).';
        error = 'BadRequest';
        break;
      }

      // P2025: Registro requerido no encontrado (Record not found)
      case 'P2025': {
        status = HttpStatus.NOT_FOUND;
        message = (exception.meta?.cause as string) || 'El recurso solicitado no fue encontrado.';
        error = 'NotFound';
        break;
      }

      default:
        this.logger.error(`Error Prisma no controlado [${exception.code}]: ${exception.message}`, exception.stack);
        break;
    }
  }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      code,
      timestamp: new Date().toISOString(),
    });
  }
}
