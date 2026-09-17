import { EstadoMesa } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class QueryMesaDto {
  @IsOptional()
  @IsEnum(EstadoMesa, {
    message: `El filtro de estado debe ser uno de los siguientes valores: ${Object.values(EstadoMesa).join(', ')}.`,
  })
  estado?: EstadoMesa;
}
