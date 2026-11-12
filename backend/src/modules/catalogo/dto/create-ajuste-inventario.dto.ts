import { ApiProperty } from '@nestjs/swagger';
import { TipoAjuste } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateAjusteInventarioDto {
  @ApiProperty({
    description: 'Naturaleza del movimiento de existencias',
    enum: TipoAjuste,
    example: TipoAjuste.Entrada,
  })
  @IsEnum(TipoAjuste, {
    message: `El tipo de ajuste debe ser uno de los siguientes valores: ${Object.values(TipoAjuste).join(', ')}.`,
  })
  tipo_ajuste!: TipoAjuste;

  @ApiProperty({
    description: 'Cantidad física ingresada, mermada o ajustada',
    example: 10,
    minimum: 0,
  })
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(0, { message: 'La cantidad no puede ser negativa.' })
  cantidad!: number;

  @ApiProperty({
    description: 'Justificación o soporte del ajuste contable/físico',
    example: 'Recepción de pedido con proveedor La Holandesa #8491',
    maxLength: 255,
  })
  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El motivo del ajuste de inventario es obligatorio.' })
  @MaxLength(255, { message: 'El motivo no puede exceder 255 caracteres.' })
  motivo!: string;
}
