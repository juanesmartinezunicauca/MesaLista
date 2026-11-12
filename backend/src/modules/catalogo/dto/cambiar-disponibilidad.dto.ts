import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class CambiarDisponibilidadDto {
  @ApiProperty({
    description: 'Estado de disponibilidad del producto',
    example: true,
  })
  @IsNotEmpty({ message: 'El campo disponible es obligatorio.' })
  @IsBoolean({ message: 'La disponibilidad debe ser un valor booleano (true o false).' })
  disponible!: boolean;
}
