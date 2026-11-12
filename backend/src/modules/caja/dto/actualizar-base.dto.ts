import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class ActualizarBaseDto {
  @ApiProperty({
    description: 'Nuevo valor base de la caja activa',
    example: 250000.0,
    minimum: 0,
  })
  @IsNumber({}, { message: 'El valor base debe ser un número válido' })
  @Min(0, { message: 'El valor base no puede ser negativo' })
  valor_inicial!: number;
}
