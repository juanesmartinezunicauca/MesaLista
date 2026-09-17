import { EstadoMesa } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class CreateMesaDto {
  @IsInt({ message: 'El número de mesa debe ser un número entero.' })
  @Min(1, { message: 'El número de mesa debe ser mayor o igual a 1.' })
  @Type(() => Number)
  numero!: number;

  @IsOptional()
  @IsEnum(EstadoMesa, {
    message: `El estado debe ser uno de los siguientes valores: ${Object.values(EstadoMesa).join(', ')}.`,
  })
  estado?: EstadoMesa;
}
