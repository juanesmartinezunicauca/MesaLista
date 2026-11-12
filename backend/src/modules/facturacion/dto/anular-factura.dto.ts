import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnularFacturaDto {
  @ApiProperty({
    description: 'Motivo formal de anulación del comprobante contable',
    example: 'Error en digitación de monto o medio de pago duplicado',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'El motivo de anulación es obligatorio.' })
  @IsString({ message: 'El motivo de anulación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'El motivo de anulación no puede superar los 255 caracteres.' })
  motivo!: string;
}
