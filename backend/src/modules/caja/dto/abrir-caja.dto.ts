import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AbrirCajaDto {
  @ApiProperty({
    description: 'Fondo o base monetaria inicial en efectivo para iniciar el turno (COP)',
    example: 200000.0,
    minimum: 0,
  })
  @IsNotEmpty({ message: 'El valor base inicial es obligatorio.' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El valor base debe ser un número válido.' })
  @Min(0, { message: 'El valor base no puede ser negativo.' })
  valor_inicial!: number;
}
