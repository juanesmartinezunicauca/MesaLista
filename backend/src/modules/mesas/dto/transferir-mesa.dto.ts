import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class TransferirMesaDto {
  @ApiProperty({
    description: 'ID de la mesa origen (actualmente ocupada con comandas)',
    example: 2,
  })
  @IsInt({ message: 'El ID de la mesa origen debe ser un número entero.' })
  @IsPositive({ message: 'El ID de la mesa origen debe ser mayor a 0.' })
  id_origen!: number;

  @ApiProperty({
    description: 'ID de la mesa destino (debe estar libre para recibir las comandas)',
    example: 5,
  })
  @IsInt({ message: 'El ID de la mesa destino debe ser un número entero.' })
  @IsPositive({ message: 'El ID de la mesa destino debe ser mayor a 0.' })
  id_destino!: number;
}
