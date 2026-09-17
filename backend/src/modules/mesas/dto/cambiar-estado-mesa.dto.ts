import { EstadoMesa } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class CambiarEstadoMesaDto {
  @IsNotEmpty({ message: 'El estado de la mesa es requerido.' })
  @IsEnum(EstadoMesa, {
    message: `El estado debe ser uno de los siguientes valores: ${Object.values(EstadoMesa).join(', ')}.`,
  })
  estado!: EstadoMesa;
}
